import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, MessageCircle, Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatWindow = ({ isOpen, onClose }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm Robert, your personal routine planning assistant. I can see your current schedule and help you optimize your time. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Get the user's session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error("Please log in to use the chat");
        setIsLoading(false);
        setMessages((prev) => prev.slice(0, -1)); // Remove user message
        return;
      }

      // Save user message to database
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        content: userMessage
      });

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      // Handle rate limiting and payment errors
      if (response.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.");
        setIsLoading(false);
        return;
      }

      if (response.status === 402) {
        toast.error("Service unavailable. Please contact support.");
        setIsLoading(false);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("Failed to start stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantContent = "";
      let toolCallId = "";
      let toolCallName = "";
      let toolCallArgs = "";

      // Create initial assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            
            if (content) {
              assistantContent += content;
              // Update the last assistant message
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            }

            // Handle tool calls
            if (toolCalls && toolCalls[0]) {
              const toolCall = toolCalls[0];
              if (toolCall.id) toolCallId = toolCall.id;
              if (toolCall.function?.name) toolCallName = toolCall.function.name;
              if (toolCall.function?.arguments) toolCallArgs += toolCall.function.arguments;
            }

            // Check for finish reason to execute tool
            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (finishReason === "tool_calls") {
              if (toolCallName === "create_routine") {
                try {
                  const args = JSON.parse(toolCallArgs);
                  console.log("Creating routine with args:", args);
                  
                  // Create the routine in the database
                  const { error: insertError } = await supabase
                    .from('routines')
                    .insert([{
                      user_id: session.user.id,
                      name: args.name,
                      time: args.time,
                      date: args.date,
                      description: args.description || null,
                      location: args.location || null,
                    }]);

                  if (insertError) {
                    console.error("Error creating routine:", insertError);
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `I tried to create the routine, but there was an error: ${insertError.message}. Please try again.`,
                      };
                      return updated;
                    });
                  } else {
                    // Success - show confirmation message
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `✅ Great! I've added "${args.name}" to your schedule for ${args.date} at ${args.time}${args.location ? ` at ${args.location}` : ''}. The page will refresh to show your new routine.`,
                      };
                      return updated;
                    });
                    
                    toast.success(`Routine "${args.name}" created successfully!`);
                    
                    // Refresh the page after a short delay
                    setTimeout(() => {
                      window.location.reload();
                    }, 2000);
                  }
                } catch (parseError) {
                  console.error("Error parsing tool arguments:", parseError);
                }
              } else if (toolCallName === "update_routine") {
                try {
                  const args = JSON.parse(toolCallArgs);
                  console.log("Updating routine with args:", args);
                  
                  // Build the update object with only provided fields
                  const updateData: any = {};
                  if (args.new_name) updateData.name = args.new_name;
                  if (args.new_time) updateData.time = args.new_time;
                  if (args.new_date) updateData.date = args.new_date;
                  if (args.new_description !== undefined) updateData.description = args.new_description;
                  if (args.new_location !== undefined) updateData.location = args.new_location;
                  
                  // Update the routine in the database
                  const { error: updateError } = await supabase
                    .from('routines')
                    .update(updateData)
                    .eq('user_id', session.user.id)
                    .eq('name', args.routine_name)
                    .eq('date', args.routine_date);

                  if (updateError) {
                    console.error("Error updating routine:", updateError);
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `I tried to update the routine, but there was an error: ${updateError.message}. Please try again.`,
                      };
                      return updated;
                    });
                  } else {
                    // Success - show confirmation message
                    const changedFields = Object.keys(updateData).map(key => {
                      if (key === 'name') return `name to "${updateData[key]}"`;
                      if (key === 'time') return `time to ${updateData[key]}`;
                      if (key === 'date') return `date to ${updateData[key]}`;
                      if (key === 'location') return `location to ${updateData[key]}`;
                      if (key === 'description') return 'description';
                      return key;
                    }).join(', ');
                    
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `✅ Perfect! I've updated "${args.routine_name}" - changed ${changedFields}. The page will refresh to show the changes.`,
                      };
                      return updated;
                    });
                    
                    toast.success(`Routine "${args.routine_name}" updated successfully!`);
                    
                    // Refresh the page after a short delay
                    setTimeout(() => {
                      window.location.reload();
                    }, 2000);
                  }
                } catch (parseError) {
                  console.error("Error parsing tool arguments:", parseError);
                }
              } else if (toolCallName === "delete_routine") {
                try {
                  const args = JSON.parse(toolCallArgs);
                  console.log("Deleting routine with args:", args);
                  
                  // Delete the routine from the database
                  const { error: deleteError } = await supabase
                    .from('routines')
                    .delete()
                    .eq('user_id', session.user.id)
                    .eq('name', args.routine_name)
                    .eq('date', args.routine_date);

                  if (deleteError) {
                    console.error("Error deleting routine:", deleteError);
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `I tried to delete the routine, but there was an error: ${deleteError.message}. Please try again.`,
                      };
                      return updated;
                    });
                  } else {
                    // Success - show confirmation message
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `✅ Done! I've deleted "${args.routine_name}" from ${args.routine_date}. The page will refresh to show the updated schedule.`,
                      };
                      return updated;
                    });
                    
                    toast.success(`Routine "${args.routine_name}" deleted successfully!`);
                    
                    // Refresh the page after a short delay
                    setTimeout(() => {
                      window.location.reload();
                    }, 2000);
                  }
                } catch (parseError) {
                  console.error("Error parsing tool arguments:", parseError);
                }
              } else if (toolCallName === "get_weather") {
                try {
                  const args = JSON.parse(toolCallArgs);
                  console.log("Getting weather with args:", args);
                  
                  let location = args.location;
                  
                  // If no location provided, get user's current location
                  if (!location || location === "current" || location === "here" || location === "my location") {
                    try {
                      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                          enableHighAccuracy: true,
                          timeout: 5000,
                          maximumAge: 0
                        });
                      });
                      
                      location = `${position.coords.latitude},${position.coords.longitude}`;
                      console.log("Using current location:", location);
                    } catch (geoError) {
                      console.error("Geolocation error:", geoError);
                      setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                          role: "assistant",
                          content: `I need your location permission to get the weather. Please enable location access in your browser or specify a city name.`,
                        };
                        return updated;
                      });
                      return;
                    }
                  }
                  
                  // Call the weather edge function
                  const { data: weatherData, error: weatherError } = await supabase.functions.invoke('get-weather', {
                    body: { 
                      location: location,
                      datetime: args.datetime
                    }
                  });

                  if (weatherError || !weatherData) {
                    console.error("Error fetching weather:", weatherError);
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: `I tried to get the weather information, but encountered an error. Please try again.`,
                      };
                      return updated;
                    });
                  } else {
                    // Format the weather response
                    const timeStr = args.datetime ? ` at ${new Date(args.datetime).toLocaleString()}` : ' currently';
                    const weatherMessage = `🌤️ Weather in ${weatherData.location}${timeStr}:\n\n` +
                      `Temperature: ${weatherData.temperature}°F (feels like ${weatherData.feelsLike}°F)\n` +
                      `Conditions: ${weatherData.description}\n` +
                      `Humidity: ${weatherData.humidity}%\n` +
                      `Wind Speed: ${weatherData.windSpeed} mph`;
                    
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: weatherMessage,
                      };
                      return updated;
                    });
                  }
                } catch (parseError) {
                  console.error("Error parsing tool arguments:", parseError);
                }
              }
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw || raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            // Ignore partial leftovers
          }
        }
      }

      // Save assistant message to database
      if (assistantContent) {
        await supabase.from('chat_messages').insert({
          user_id: session.user.id,
          role: 'assistant',
          content: assistantContent
        });
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error streaming chat:", error);
      toast.error("Failed to send message. Please try again.");
      setIsLoading(false);
      // Remove the user message if error occurred
      setMessages((prev) => prev.slice(0, -1));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    await streamChat(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = () => {
    try {
      // Check if browser supports Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast.error('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        console.log('Voice recognition started');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please enable microphone permissions.');
        } else if (event.error === 'no-speech') {
          toast.error('No speech detected. Please try again.');
        } else {
          toast.error(`Speech recognition error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        console.log('Voice recognition ended');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start voice recognition');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 h-[600px] flex flex-col">
      <Card className="flex flex-col h-full shadow-elegant border-border/50 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Robert</h3>
              <p className="text-xs text-muted-foreground">Your Routine Assistant</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
