import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, unsplashImg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Plus, MapPin, Calendar, Users, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get("/trips");
      setTrips(res.data);
    } catch {
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id) => {
    try {
      await api.delete(`/trips/${id}`);
      toast.success("Trip deleted");
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] font-bold text-[#81B29A] mb-3">
            Hello, {user?.name?.split(" ")[0]}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight">
            Your trips
          </h1>
        </div>
        <Link to="/plan" data-testid="dashboard-new-trip">
          <Button className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white h-12 px-6">
            <Plus size={18} className="mr-2" /> New trip
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-white border border-border animate-pulse" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((t, idx) => (
            <TripCard key={t.id} trip={t} idx={idx} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, idx, onDelete }) {
  return (
    <div
      className="bg-white border border-border rounded-2xl overflow-hidden hover-lift fade-up"
      style={{ animationDelay: `${idx * 80}ms` }}
      data-testid={`trip-card-${trip.id}`}
    >
      <Link to={`/trips/${trip.id}`} className="block">
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={unsplashImg(trip.cover_image_query || trip.destination, 800, 500)}
            alt={trip.destination}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1776059288747-ec1920fb46f8";
            }}
          />
        </div>
      </Link>
      <div className="p-6">
        <Link to={`/trips/${trip.id}`}>
          <h3 className="font-heading text-xl font-medium mb-2 hover:text-[#E27D60] transition-colors">
            {trip.title}
          </h3>
        </Link>
        <p className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <MapPin size={14} /> {trip.destination}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar size={12} /> {trip.days} days</span>
          <span className="flex items-center gap-1"><Wallet size={12} /> {trip.budget}</span>
          <span className="flex items-center gap-1"><Users size={12} /> {trip.travelers}</span>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Link to={`/trips/${trip.id}`} data-testid={`view-trip-${trip.id}`}>
            <Button variant="ghost" className="rounded-full text-[#E27D60] hover:bg-[#F7F5F0] hover:text-[#D96C4E] -ml-3">
              Open →
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                data-testid={`delete-trip-${trip.id}`}
                className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
                aria-label="Delete trip"
              >
                <Trash2 size={16} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the itinerary and all photos linked to it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  data-testid="confirm-delete"
                  onClick={() => onDelete(trip.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-border rounded-2xl p-16 text-center max-w-2xl mx-auto">
      <div className="w-16 h-16 rounded-full bg-[#F7F5F0] mx-auto mb-6 flex items-center justify-center text-[#E27D60]">
        <MapPin size={28} />
      </div>
      <h3 className="font-heading text-2xl font-medium mb-3">No trips yet</h3>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Your saved itineraries will appear here. Let&apos;s plan something exciting.
      </p>
      <Link to="/plan">
        <Button className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white h-12 px-8">
          <Plus size={18} className="mr-2" /> Plan your first trip
        </Button>
      </Link>
    </div>
  );
}
