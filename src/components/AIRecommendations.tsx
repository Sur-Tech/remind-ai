import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const AIRecommendations = () => {
  const [open, setOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{ routineCount: number; eventCount: number } | null>(null);
  const [lastFetchDate, setLastFetchDate] = useState<string>("");
  const [hasUnreadRecommendations, setHasUnreadRecommendations] = useState(false);

  // Check for unread AI-generated recommendations
  const checkForUnreadRecommendations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking recommendations:', error);
        return;
      }

      if (data && data.length > 0) {
        setHasUnreadRecommendations(true);
        // Auto-load the latest recommendation
        setRecommendations(data[0].recommendations);
        setStats({
          routineCount: data[0].routine_count,
          eventCount: data[0].event_count
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      setRecommendations("");
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to get recommendations");
        return;
      }

      console.log("Fetching AI recommendations...");
      const { data, error } = await supabase.functions.invoke('ai-routine-recommendations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error fetching recommendations:", error);
        
        if (error.message?.includes('429')) {
          toast.error("Too many requests. Please try again in a moment.");
          return;
        }
        
        if (error.message?.includes('402')) {
          toast.error("AI credits depleted. Please top up your workspace.");
          return;
        }
        
        throw error;
      }

      console.log("Recommendations received:", data);
      setRecommendations(data.recommendations);
      setStats({
        routineCount: data.routineCount,
        eventCount: data.eventCount
      });
      
      toast.success("AI recommendations generated!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to generate recommendations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    
    if (newOpen) {
      // Check for stored recommendations first
      await checkForUnreadRecommendations();
      
      // Mark as read if there are unread recommendations
      if (hasUnreadRecommendations) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase
            .from('ai_recommendations')
            .update({ read: true })
            .eq('user_id', session.user.id)
            .eq('read', false);
          setHasUnreadRecommendations(false);
        }
      }
      
      const today = new Date().toISOString().split('T')[0];
      // Only fetch fresh recommendations if it's a new day and we want to override stored ones
      if (!recommendations || lastFetchDate !== today) {
        // Don't auto-fetch, let user click refresh if they want fresh recommendations
        setLastFetchDate(today);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-primary hover:opacity-90 relative">
          <Sparkles className="w-4 h-4" />
          Your Personalized Routine
          {hasUnreadRecommendations && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-primary" />
            Your Personalized AI Recommendations
          </DialogTitle>
          <DialogDescription>
            Based on your routines and calendar events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing your schedule...</p>
            </div>
          ) : recommendations ? (
            <>
              {stats && (
                <div className="flex gap-4 text-sm text-muted-foreground pb-2 border-b">
                  <span>📅 {stats.routineCount} routines analyzed</span>
                  <span>🗓️ {stats.eventCount} events reviewed</span>
                </div>
              )}
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-foreground">
                  {recommendations}
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={fetchRecommendations}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Refresh Recommendations
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recommendations available. Try adding some routines or events first.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
