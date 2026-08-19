import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Users, CalendarDays, Music2, HeartHandshake, CreditCard,
  ClipboardCheck, MessageSquare, ArrowRight, Check,
} from "lucide-react";
import logo from "@/assets/rechoir-logo.png";

const features = [
  { icon: CalendarDays, title: "Rehearsal Schedules", body: "Plan, notify, and track every rehearsal with attendance baked in." },
  { icon: Music2, title: "Song Readiness", body: "Per-member status for every song. Know who's Ready, who's Learning." },
  { icon: HeartHandshake, title: "Prayer Chains", body: "Continuous or scheduled prayer with assigned shifts." },
  { icon: CreditCard, title: "Due Payments", body: "Collect dues, track proofs, send reminders automatically." },
  { icon: ClipboardCheck, title: "Attendance Analytics", body: "Trend lines and at-risk flags to keep the team accountable." },
  { icon: MessageSquare, title: "Real-time Chat", body: "Team-wide chat, mentions and broadcast announcements." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="RECHOIR" className="h-10 w-10 rounded-lg object-contain bg-white" />
          <span className="font-extrabold text-xl tracking-tight">RECHOIR</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/register-team">
            <Button className="gradient-primary text-primary-foreground shadow-glow">Start your choir</Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-4 pt-16 pb-24 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          Built for African church choirs
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight text-foreground">
          The choir command center<br />
          <span className="text-primary">your team deserves.</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
          Replace WhatsApp chaos and lost spreadsheets. RECHOIR unifies rehearsals,
          songs, attendance, payments, prayer chains and your team — in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
          <Link to="/register-team">
            <Button size="lg" className="gradient-primary text-primary-foreground shadow-glow h-12 px-8">
              Create your choir
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="h-12 px-8">I'm a choir member</Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" /> Free to start</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" /> Mobile-ready</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" /> Real-time chat</span>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Everything your ministry runs on</h2>
          <p className="text-muted-foreground mt-3">One home for rehearsals, songs, attendance, prayer, chat and dues.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl p-6 border border-border bg-card transition-smooth hover:shadow-elegant">
              <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shadow-glow mb-4">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-bold text-lg mb-1 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <div className="rounded-3xl p-10 md:p-16 text-center border border-border bg-card shadow-elegant">
          <Users className="h-12 w-12 text-secondary mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3 text-foreground">One team. One choir code.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Every choir gets a unique 8-character access code. Members sign in with
            their email and your choir code — or use the invite link you send them.
          </p>
          <Link to="/register-team">
            <Button size="lg" className="gradient-gold text-secondary-foreground shadow-gold h-12 px-8">
              Get your choir code <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          © {new Date().getFullYear()} RECHOIR. Built with reverence.
        </div>
      </footer>
    </div>
  );
}
