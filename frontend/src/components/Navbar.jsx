import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Compass, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-full bg-[#E27D60] flex items-center justify-center text-white">
            <Compass size={18} />
          </div>
          <span className="font-heading text-xl font-medium tracking-tight">Wander</span>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" data-testid="nav-dashboard">
                <Button variant="ghost" className="rounded-full">My Trips</Button>
              </Link>
              <Link to="/plan" data-testid="nav-plan">
                <Button className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white">
                  Plan a Trip
                </Button>
              </Link>
              <button
                data-testid="nav-logout"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login">
                <Button variant="ghost" className="rounded-full">Login</Button>
              </Link>
              <Link to="/signup" data-testid="nav-signup">
                <Button className="rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
