import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gem, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: err.response?.data?.error ?? 'Invalid credentials',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left decorative panel */}
      <div className="hidden lg:flex w-1/2 gold-gradient flex-col items-center justify-center p-12 text-white">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center">
              <Gem className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="font-heading text-5xl font-bold tracking-wide">Jever Jwellers</h1>
          <p className="text-white/80 text-lg font-light max-w-xs leading-relaxed">
            Crafting elegance, managing brilliance — your complete jewelry management solution.
          </p>
          <div className="pt-4 flex gap-8 justify-center text-center">
            {[
              { label: 'Invoicing', icon: '📄' },
              { label: 'Inventory', icon: '💎' },
              { label: 'Analytics', icon: '📊' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-medium text-white/70 uppercase tracking-widest">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left">
            <div className="flex lg:hidden justify-center mb-4">
              <div className="h-14 w-14 rounded-full gold-gradient flex items-center justify-center">
                <Gem className="h-7 w-7 text-white" />
              </div>
            </div>
            <h2 className="font-heading text-3xl font-semibold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to Jever Jwellers admin</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@jever.com"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" variant="gold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Jever Jwellers Admin &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
