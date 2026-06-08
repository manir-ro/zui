import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, unsplashImg, googleMapsUrl, photoUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Calendar,
  Users,
  Wallet,
  ExternalLink,
  Camera,
  Upload,
  Sun,
  Sunset,
  Moon,
  Hotel as HotelIcon,
  ArrowLeft,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const TIME_ICONS = {
  morning: <Sun size={14} />,
  afternoon: <Sunset size={14} />,
  evening: <Moon size={14} />,
};

export default function TripDetail() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [t, p] = await Promise.all([
        api.get(`/trips/${id}`),
        api.get(`/trips/${id}/photos`),
      ]);
      setTrip(t.data);
      setPhotos(p.data);
    } catch {
      toast.error("Failed to load trip");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPhotosSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await api.post(`/trips/${id}/photos`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setPhotos((prev) => [res.data, ...prev]);
      }
      toast.success(`${files.length} photo(s) uploaded`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDeletePhoto = async (photoId) => {
    try {
      await api.delete(`/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success("Photo removed");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const onRefreshImages = async () => {
    const toastId = toast.loading("Fetching real images…");
    try {
      const res = await api.post(`/trips/${id}/refresh-images`);
      setTrip(res.data);
      toast.success("Images refreshed!", { id: toastId });
    } catch {
      toast.error("Failed to refresh images", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <div className="h-96 rounded-2xl bg-white border border-border animate-pulse" />
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
      <Link to="/dashboard" data-testid="back-to-dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft size={16} /> Back to trips
      </Link>

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-10 fade-up">
        <img
          src={trip.cover_image_url || unsplashImg(trip.cover_image_query || trip.destination, 1600, 700)}
          alt={trip.destination}
          className="w-full h-[40vh] sm:h-[55vh] object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1776059288747-ec1920fb46f8";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12 text-white">
          <p className="text-sm uppercase tracking-[0.2em] font-bold opacity-80 mb-3">
            {trip.travelers} · {trip.budget}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight mb-4 text-balance">
            {trip.title}
          </h1>
          <div className="flex flex-wrap gap-5 text-sm opacity-90">
            <span className="flex items-center gap-2"><MapPin size={16} /> {trip.destination}</span>
            <span className="flex items-center gap-2"><Calendar size={16} /> {trip.days} days</span>
            <span className="flex items-center gap-2"><Users size={16} /> {trip.travelers}</span>
            <span className="flex items-center gap-2"><Wallet size={16} /> {trip.budget}</span>
          </div>
        </div>
      </div>

      {trip.overview && (
        <p className="text-lg text-muted-foreground max-w-3xl mb-6 leading-relaxed">
          {trip.overview}
        </p>
      )}

      {!trip.cover_image_url && (
        <div className="mb-8">
          <Button
            data-testid="refresh-images-btn"
            onClick={onRefreshImages}
            variant="outline"
            className="rounded-full"
          >
            <RefreshCw size={14} className="mr-2" /> Fetch real photos for this trip
          </Button>
        </div>
      )}

      <Tabs defaultValue="itinerary" className="w-full">
        <TabsList className="bg-white border border-border rounded-full p-1 h-12">
          <TabsTrigger data-testid="tab-itinerary" value="itinerary" className="rounded-full px-6 h-10 data-[state=active]:bg-[#E27D60] data-[state=active]:text-white">
            Itinerary
          </TabsTrigger>
          <TabsTrigger data-testid="tab-photos" value="photos" className="rounded-full px-6 h-10 data-[state=active]:bg-[#E27D60] data-[state=active]:text-white">
            Photos ({photos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary" className="mt-8 space-y-8">
          {trip.itinerary.map((day, idx) => (
            <DayBlock key={day.day} day={day} idx={idx} />
          ))}
        </TabsContent>

        <TabsContent value="photos" className="mt-8">
          <PhotoGallery
            photos={photos}
            uploading={uploading}
            onUpload={() => fileRef.current?.click()}
            onDelete={onDeletePhoto}
          />
          <input
            ref={fileRef}
            type="file"
            data-testid="photo-upload-input"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPhotosSelected}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DayBlock({ day, idx }) {
  return (
    <div
      className="bg-white border border-border rounded-2xl p-8 fade-up"
      style={{ animationDelay: `${idx * 80}ms` }}
      data-testid={`day-${day.day}`}
    >
      <div className="flex items-baseline gap-4 mb-6">
        <span className="font-heading text-5xl font-light text-[#E27D60]">
          {String(day.day).padStart(2, "0")}
        </span>
        <div>
          <h2 className="font-heading text-2xl font-medium">{day.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{day.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {day.places.map((p, i) => (
            <PlaceCard key={i} place={p} />
          ))}
        </div>
        <div className="lg:col-span-4">
          <HotelCard hotel={day.hotel} />
        </div>
      </div>
    </div>
  );
}

function PlaceCard({ place }) {
  return (
    <div className="bg-[#F7F5F0] rounded-2xl overflow-hidden border border-border hover-lift">
      <div className="aspect-[16/10] overflow-hidden">
        <img
          src={place.image_url || unsplashImg(place.image_query || place.name, 600, 400)}
          alt={place.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1431274172761-fca41d930114";
          }}
        />
      </div>
      <div className="p-5">
        <Badge variant="outline" className="rounded-full text-xs gap-1 mb-3 capitalize border-[#81B29A] text-[#3a6450]">
          {TIME_ICONS[place.time_of_day] || <Sun size={14} />} {place.time_of_day}
        </Badge>
        <h3 className="font-heading text-lg font-medium mb-1">{place.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-3">
          {place.description}
        </p>
        <a
          href={googleMapsUrl(place.location_query || place.name)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`maps-${place.name.replace(/\s+/g, "-").toLowerCase()}`}
        >
          <Button variant="outline" size="sm" className="rounded-full w-full">
            <MapPin size={14} className="mr-2" /> Open in Maps <ExternalLink size={12} className="ml-2" />
          </Button>
        </a>
      </div>
    </div>
  );
}

function HotelCard({ hotel }) {
  return (
    <div className="bg-gradient-to-br from-[#81B29A]/10 to-white rounded-2xl overflow-hidden border border-border hover-lift h-full flex flex-col">
      <div className="aspect-[16/10] overflow-hidden">
        <img
          src={hotel.image_url || unsplashImg(hotel.image_query || hotel.name, 600, 400)}
          alt={hotel.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1611892440504-42a792e24d32";
          }}
        />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <HotelIcon size={14} className="text-[#81B29A]" />
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#81B29A]">
            Stay · {hotel.price_range}
          </span>
        </div>
        <h3 className="font-heading text-lg font-medium mb-1">{hotel.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed flex-1">
          {hotel.description}
        </p>
        <a
          href={googleMapsUrl(hotel.location_query || hotel.name)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`maps-hotel-${hotel.name.replace(/\s+/g, "-").toLowerCase()}`}
        >
          <Button variant="outline" size="sm" className="rounded-full w-full">
            <MapPin size={14} className="mr-2" /> Open in Maps <ExternalLink size={12} className="ml-2" />
          </Button>
        </a>
      </div>
    </div>
  );
}

function PhotoGallery({ photos, uploading, onUpload, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          {photos.length === 0 ? "No photos yet" : `${photos.length} memories`}
        </p>
        <Button
          data-testid="upload-photos-btn"
          onClick={onUpload}
          disabled={uploading}
          className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white"
        >
          <Upload size={16} className="mr-2" />
          {uploading ? "Uploading…" : "Upload photos"}
        </Button>
      </div>

      {photos.length === 0 ? (
        <div className="bg-white border border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F7F5F0] mx-auto mb-6 flex items-center justify-center text-[#E27D60]">
            <Camera size={28} />
          </div>
          <h3 className="font-heading text-2xl font-medium mb-3">Start your memory album</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Upload photos from this trip — they&apos;ll be safely stored in the cloud and viewable here forever.
          </p>
          <Button onClick={onUpload} className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white">
            <Upload size={16} className="mr-2" /> Upload your first photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((p) => (
            <div
              key={p.id}
              data-testid={`photo-${p.id}`}
              className="relative aspect-square rounded-2xl overflow-hidden bg-muted group"
            >
              <img
                src={photoUrl(p.id)}
                alt={p.original_filename}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <button
                data-testid={`delete-photo-${p.id}`}
                onClick={() => onDelete(p.id)}
                className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                aria-label="Delete photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
