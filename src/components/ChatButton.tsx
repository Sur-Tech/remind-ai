import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { ChatWindow } from "./ChatWindow";

export const ChatButton = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {!isChatOpen && (
        <Button
          onClick={() => setIsChatOpen(true)}
          size="lg"
          className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-elegant bg-primary hover:bg-primary/90 transition-smooth"
        >
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </Button>
      )}
      <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};
