import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Loader2, Sparkles, MapPin, Calendar, Wallet, Users } from "lucide-react";

const INTEREST_OPTIONS = [
  "Beaches", "Mountains", "History", "Museums", "Food", "Nightlife",
  "Shopping", "Adventure", "Nature", "Art", "Architecture", "Relaxation",
];

export default function PlanTrip() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(5);
  const [budget, setBudget] = useState("mid-range");
  const [travelers, setTravelers] = useState("couple");
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (i) => {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destination.trim()) {
      toast.error("Where do you want to go?");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/trips/generate", {
        destination: destination.trim(),
        days: Number(days),
        budget,
        travelers,
        interests,
      });
      toast.success("Your itinerary is ready!");
      navigate(`/trips/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate trip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-12 py-16">
      <p className="text-sm uppercase tracking-[0.2em] font-bold text-[#81B29A] mb-3">Plan a trip</p>
      <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight mb-4">
        Let&apos;s design your getaway.
      </h1>
      <p className="text-muted-foreground text-lg mb-12 max-w-2xl">
        Tell us a few details and our AI will craft a personalized day-by-day itinerary in seconds.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-border rounded-2xl p-8 lg:p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="destination" className="flex items-center gap-2 text-sm font-medium mb-2">
              <MapPin size={14} className="text-[#E27D60]" /> Destination
            </Label>
            <Input
              id="destination"
              data-testid="plan-destination"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Tokyo, Japan"
              className="rounded-xl h-12"
            />
          </div>
          <div>
            <Label htmlFor="days" className="flex items-center gap-2 text-sm font-medium mb-2">
              <Calendar size={14} className="text-[#E27D60]" /> Number of days
            </Label>
            <Input
              id="days"
              data-testid="plan-days"
              type="number"
              min={1}
              max={30}
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="rounded-xl h-12"
            />
          </div>
          <div>
            <Label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Wallet size={14} className="text-[#E27D60]" /> Budget
            </Label>
            <Select value={budget} onValueChange={setBudget}>
              <SelectTrigger data-testid="plan-budget" className="rounded-xl h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="budget">Budget — backpacker friendly</SelectItem>
                <SelectItem value="mid-range">Mid-range — comfortable</SelectItem>
                <SelectItem value="luxury">Luxury — splurge worthy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Users size={14} className="text-[#E27D60]" /> Traveling with
            </Label>
            <Select value={travelers} onValueChange={setTravelers}>
              <SelectTrigger data-testid="plan-travelers" className="rounded-xl h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo</SelectItem>
                <SelectItem value="couple">Couple</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium block mb-3">Interests (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((i) => {
              const selected = interests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  data-testid={`interest-${i.toLowerCase()}`}
                  onClick={() => toggleInterest(i)}
                  className={`px-4 py-2 rounded-full text-sm border transition-all ${
                    selected
                      ? "bg-[#E27D60] text-white border-[#E27D60]"
                      : "bg-white text-foreground border-border hover:border-[#E27D60]"
                  }`}
                >
                  {i}
                </button>
              );
            })}
          </div>
          {interests.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {interests.length} selected
            </p>
          )}
        </div>

        <Button
          type="submit"
          data-testid="plan-submit"
          disabled={loading}
          className="w-full h-14 rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white text-base"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} /> Crafting your itinerary…
            </>
          ) : (
            <>
              <Sparkles size={18} className="mr-2" /> Generate itinerary
            </>
          )}
        </Button>
        {loading && (
          <p className="text-center text-sm text-muted-foreground -mt-2">
            This takes ~20–40 seconds. Don&apos;t close this tab.
          </p>
        )}
      </form>
    </div>
  );
}
