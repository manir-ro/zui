import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, Camera, Calendar, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1776059288747-ec1920fb46f8"
            alt="Coastal road trip"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#F7F5F0]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-24 pb-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/40 mb-8 fade-up">
              <Sparkles size={14} className="text-[#E27D60]" />
              <span className="text-sm font-medium text-white">Powered by Claude Sonnet 4.5</span>
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl tracking-tight font-light text-white text-balance fade-up" style={{ animationDelay: "120ms" }}>
              Your next journey,<br />
              <span className="italic font-normal">crafted by AI.</span>
            </h1>
            <p className="mt-8 text-lg sm:text-xl text-white/90 max-w-xl leading-relaxed fade-up" style={{ animationDelay: "240ms" }}>
              Tell us where, when, and with whom — and we&apos;ll build a day-by-day itinerary with the best places to visit, hotels to stay, and photo memories to save.
            </p>
            <div className="mt-12 flex flex-wrap gap-4 fade-up" style={{ animationDelay: "360ms" }}>
              <Link to="/signup" data-testid="hero-get-started">
                <Button size="lg" className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white px-8 h-14 text-base">
                  Start planning <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              <Link to="/login" data-testid="hero-login">
                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base bg-white/10 backdrop-blur text-white border-white/40 hover:bg-white/20 hover:text-white">
                  I have an account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="mb-16">
          <p className="text-sm uppercase tracking-[0.2em] font-bold text-[#81B29A] mb-3">How it works</p>
          <h2 className="font-heading text-4xl sm:text-5xl tracking-tight font-light max-w-3xl">
            Four ingredients. One unforgettable trip.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <FeatureCard
            span="md:col-span-7"
            icon={<Sparkles size={20} />}
            title="AI itineraries"
            desc="Tell us your destination, days, budget, and travel style. Claude Sonnet 4.5 builds a tailored day-by-day plan in seconds."
            img="https://images.unsplash.com/photo-1548957175-84f0f9af659e"
          />
          <FeatureCard
            span="md:col-span-5"
            icon={<MapPin size={20} />}
            title="One-tap Maps"
            desc="Every place and hotel has a button that opens Google Maps with the exact location."
          />
          <FeatureCard
            span="md:col-span-5"
            icon={<Calendar size={20} />}
            title="Save your plans"
            desc="All your trips live in one tidy dashboard. Revisit, edit, and reshare anytime."
          />
          <FeatureCard
            span="md:col-span-7"
            icon={<Camera size={20} />}
            title="Photo memories"
            desc="Upload trip photos to a secure cloud gallery — relive every sunset, gelato, and skyline."
            img="https://images.unsplash.com/photo-1431274172761-fca41d930114"
          />
        </div>
      </section>

      <footer className="border-t border-border py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-sm text-muted-foreground">
          © 2026 Wander · Travel beautifully.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, span, img }) {
  return (
    <div className={`${span} bg-white border border-border rounded-2xl p-8 hover-lift relative overflow-hidden`}>
      {img && (
        <div className="absolute right-0 top-0 w-1/2 h-full hidden lg:block">
          <img src={img} alt="" className="w-full h-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
        </div>
      )}
      <div className="relative max-w-md">
        <div className="w-10 h-10 rounded-full bg-[#F7F5F0] flex items-center justify-center text-[#E27D60] mb-4">
          {icon}
        </div>
        <h3 className="font-heading text-2xl font-medium mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
