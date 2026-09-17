import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md bg-white border border-border rounded-2xl p-10 fade-up">
        <p className="text-sm uppercase tracking-[0.2em] font-bold text-[#81B29A] mb-3">Welcome back zui</p>
        <h1 className="font-heading text-4xl font-light tracking-tight mb-8">Log in to Wander</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              data-testid="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 rounded-xl h-12"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              data-testid="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 rounded-xl h-12"
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#E27D60] hover:bg-[#D96C4E] text-white"
          >
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-8 text-sm text-muted-foreground text-center">
          New here?{" "}
          <Link to="/signup" data-testid="login-to-signup" className="text-[#E27D60] font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
