import { Cloud, Droplets, Wind, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface WeatherDisplayProps {
  weather: {
    temperature: number;
    feelsLike: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    location: string;
    country: string;
  } | null;
  loading: boolean;
  error: string | null;
}

export const WeatherDisplay = ({ weather, loading, error }: WeatherDisplayProps) => {
  if (loading) {
    return (
      <Card className="p-3 bg-muted/50 border-border/50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading weather...</span>
        </div>
      </Card>
    );
  }

  if (error || !weather) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">
              {weather.location}, {weather.country}
            </h3>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt={weather.description}
                className="w-12 h-12"
              />
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {weather.temperature}°C
                </div>
                <div className="text-sm text-muted-foreground capitalize">
                  {weather.description}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4" />
            <span>{weather.humidity}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4" />
            <span>{weather.windSpeed} m/s</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
