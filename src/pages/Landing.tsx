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
          <img src={logo} alt="RECHOIR" className="h-10 w-10 rounded-xl object-contain" />
          <span className="font-extrabold text-xl tracking-tight">RECHOIR</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" className="h-9 py-2 px-3 text-sm">Sign in</Button></Link>
          <Link to="/register-team">
            <Button className="btn-primary h-9 py-2 px-4">Start your choir</Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-4 pt-16 pb-24 text-center max-w-4xl">
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight text-foreground mb-4">
          The choir command center
          <span className="block">your team deserves.</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Replace WhatsApp chaos and lost spreadsheets. RECHOIR unifies rehearsals,
          songs, attendance, payments, prayer chains and your team — in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link to="/register-team">
            <Button size="lg" className="btn-primary h-12 px-8">
              Create your choir
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="h-12 px-8">I'm a choir member</Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Free to start</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Mobile-ready</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Real-time chat</span>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24">
        <div className="rounded-xl p-6 md:p-8 text-center border border-border/30 bg-card mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-3">Everything your ministry runs on</h2>
          <p className="text-muted-foreground mb-6">One home for rehearsals, songs, attendance, prayer, chat and dues.</p>
          <Link to="/register-team">
            <Button size="lg" className="btn-primary h-12 px-8">Get your choir code <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg p-5 border-border/30 bg-card transition-colors hover:shadow-card-elevated hover:border-primary/20">
              <div className="h-10 w-10 rounded-md flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-1 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/30 py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          © {new Date().getFullYear()} RECHOIR. Built with reverence.
        </div>
      </footer>
    </div>
  );
}