import { useEffect } from "react";
import "./LandingPage.css";

const stats = [
  ["42", "%", "Grade-5 children unable to read Grade-2 text"],
  ["17", "M", "Children in seasonally migrating households"],
  ["1.1", "M", "Teacher posts vacant nationwide (2024)"],
  ["734", "", "Districts on a single dashboard"],
];

const yearlyReading = [
  ["2018", "78%", "28%"],
  ["2019", "75%", "27%"],
  ["2020", "64%", "23%"],
  ["2021", "67%", "24%"],
  ["2022", "58%", "21%"],
  ["2023", "52%", "19%"],
];

const steps = [
  {
    title: "Six unrelated feeds, one schema.",
    label: "STAGE 01 - INGEST",
    body: "ASER outcomes, UDISE+ school census, ISRO Bhuvan NDVI tiles, state recruitment portals, mid-day-meal coverage, and a continuously scraped local-news corpus - all normalised onto the district unit.",
    tags: ["ASER", "UDISE+", "Bhuvan NDVI", "UPSESSB", "PM-POSHAN", "news scrape"],
  },
  {
    title: "HDBSCAN finds the patterns.",
    label: "STAGE 02 - CLUSTER",
    body: "Districts are embedded across 14 features and clustered with HDBSCAN, so ambiguous districts land in a noise bucket for human review rather than being force-fit into the wrong category.",
    tags: ["14 features", "HDBSCAN", "UMAP projection", "noise-aware"],
    accent: "language",
  },
  {
    title: "SHAP names the cause, with receipts.",
    label: "STAGE 03 - ATTRIBUTE",
    body: "For every flagged district, SHAP attribution names the top features driving the label, and the Evidence Engine pulls the news, satellite, and grievance rows that actually support or contradict the hypothesis.",
    tags: ["SHAP", "Evidence Engine", "supporting / contradicting"],
    accent: "pedagogy",
  },
];

const clusters = [
  ["migration", "Seasonal Migration", "Oct-Dec - sugarcane / paddy", "Children pulled out for harvest. Attendance collapses seasonally and never fully recovers.", 146],
  ["language", "Language Barrier", "Year-round", "Medium of instruction mismatched to home language. Kids attend but don't comprehend.", 118],
  ["teacher", "Teacher Shortage", "Chronic", "Sanctioned posts unfilled for years. High PTR, untrained relief teachers, no continuity.", 167],
  ["infra", "Infrastructure", "Monsoon - Jun-Sep", "Flood-damaged or under-resourced schools. Physical reasons kids don't come.", 89],
  ["pedagogy", "Pedagogical", "Chronic", "All structural signals normal, yet learning is low. The methods themselves are broken.", 134],
];

const evidence = [
  ["support", "SUPPORTING", "\"Schools see 40% attendance drop as sugarcane cutting season begins across Devipatan division.\"", "Times of India - Gorakhpur edition - Oct 2024", "w 0.31"],
  ["support", "SUPPORTING", "ISRO Bhuvan NDVI: agricultural activity peaks Sep-Nov, inversely correlated with ASER attendance (r = -0.71).", "ISRO Bhuvan - NDVI tile UP-27 - 2018-2023", "w 0.43"],
  ["contra", "CONTRADICTING", "\"0 new teacher postings this quarter for Shravasti; sanctioned strength stable, no recent vacancy spike.\"", "UPSESSB recruitment portal - Q1 2025", "w -0.06"],
  ["irrel", "IRRELEVANT", "\"Mid-day meal coverage reported at 94% across functioning schools in the district.\"", "PM-POSHAN dashboard - 2024", "w 0.00"],
];

function Logo() {
  return (
    <a href="#top" className="landing-logo">
      <span className="landing-logo-mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-6 4 3 5-8" />
          <circle cx="8" cy="11" r="1.4" fill="#fff" stroke="none" />
          <circle cx="12" cy="14" r="1.4" fill="#fff" stroke="none" />
          <circle cx="17" cy="6" r="1.4" fill="#fff" stroke="none" />
        </svg>
      </span>
      <span>
        <span className="landing-wordmark">EduSignal</span>
        <span className="landing-tag">ROOT-CAUSE INTEL</span>
      </span>
    </a>
  );
}

function ArrowIcon() {
  return (
    <svg className="landing-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function LandingPage() {
  useEffect(() => {
    const page = document.querySelector(".landing-page");
    const animated = document.querySelectorAll(".landing-reveal");
    const progress = document.querySelector(".landing-scroll-progress");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -10% 0px" });

    animated.forEach((node) => observer.observe(node));

    const updateScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      progress?.style.setProperty("--scroll-progress", pct.toFixed(4));
      page?.style.setProperty("--scroll-y", window.scrollY.toFixed(0));
    };

    const updatePointer = (event) => {
      page?.style.setProperty("--pointer-x", `${event.clientX}px`);
      page?.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("pointermove", updatePointer);
    };
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-scroll-progress" aria-hidden="true" />
      <nav className="landing-nav">
        <div className="landing-shell landing-nav-inner">
          <Logo />
          <div className="landing-nav-links">
            <a href="#problem">Problem</a>
            <a href="#pipeline">How it works</a>
            <a href="#clusters">Cause clusters</a>
            <a href="#evidence">Evidence</a>
          </div>
          <a href="/dashboard" className="landing-btn landing-btn-primary">Launch app <ArrowIcon /></a>
        </div>
      </nav>

      <header className="landing-hero landing-reveal" id="top">
        <div className="landing-shell landing-hero-inner">
          <div className="landing-eyebrow"><span className="landing-live-dot" />ASER 2023 - UDISE+ 2023-24 - ISRO Bhuvan - Live</div>
          <h1>Stop guessing <em>why</em> a district's learning outcomes are falling.</h1>
          <p>EduSignal fuses ASER, UDISE+, satellite NDVI, vacancy portals and local news into one signal, then names the actual cause behind each district's collapse: migration, language, teachers, infrastructure, or pedagogy.</p>
          <div className="landing-hero-cta">
            <a href="/dashboard" className="landing-btn landing-btn-primary">Open the dashboard <ArrowIcon /></a>
            <a href="#pipeline" className="landing-btn landing-btn-ghost">See how it works</a>
          </div>
          <div className="landing-hero-meta">
            <div><b>734</b> districts modelled</div>
            <div><b>5</b> cause clusters - 1 noise bucket</div>
            <div><b>HDBSCAN</b> + SHAP attribution</div>
            <div><b>v1.4</b> refreshed monthly</div>
          </div>
        </div>
      </header>

      <div className="landing-stat-band">
        <div className="landing-shell landing-stat-grid">
          {stats.map(([num, unit, label], index) => (
            <div className="landing-stat landing-reveal" style={{ transitionDelay: `${index * 80}ms` }} key={label}>
              <div className="landing-stat-num">{num}{unit && <span>{unit}</span>}</div>
              <div className="landing-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="landing-block landing-reveal" id="problem">
        <div className="landing-shell">
          <div className="landing-section-eyebrow">The problem</div>
          <h2>Every district reports the same red number. Almost none can say <em>why</em>.</h2>
          <div className="landing-problem-grid">
            <div className="landing-copy landing-reveal">
              <h3>Block-level dashboards stop at "outcome dropped".</h3>
              <p>An education officer in Shravasti sees Grade-3 reading at 19% and falling 4 points year-on-year. The dashboard turns the cell red. Then what?</p>
              <p>The real cause could be sugarcane migration, a Hindi/Surjapuri language mismatch, a 12% teacher vacancy rate, a flooded Ghaghara catchment, or bad pedagogy in well-resourced schools. Each demands a different intervention.</p>
              <div className="landing-pull">EduSignal sits between "outcomes are bad" and "here is the intervention that has worked in statistically similar districts."</div>
            </div>
            <div className="landing-card landing-reveal">
              <div className="landing-axis">Shravasti - Grade-3 reading proficiency - ASER</div>
              <div className="landing-bars">
                {yearlyReading.map(([year, width, value], index) => (
                  <div className="landing-bar-row" key={year}>
                    <span>{year}</span>
                    <div><i style={{ width, animationDelay: `${index * 0.05}s` }} /></div>
                    <b className={year === "2023" ? "landing-bad" : ""}>{value}</b>
                  </div>
                ))}
              </div>
              <div className="landing-caption">A six-year decline. The chart shows that it is falling. It cannot tell you that the signal comes from cane-harvest migration.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-block landing-reveal" id="pipeline">
        <div className="landing-shell">
          <div className="landing-section-eyebrow">How it works</div>
          <h2>Ingest the noise, cluster the signal, attribute the cause.</h2>
          <p className="landing-section-sub">Three stages, each inspectable in the app. Every score traces back to the rows that produced it.</p>
          <div className="landing-pipeline">
            {steps.map((step, index) => (
              <div className={`landing-step landing-reveal ${step.accent ? `landing-step-${step.accent}` : ""}`} style={{ transitionDelay: `${index * 110}ms` }} key={step.label}>
                <div className="landing-step-icon">{index + 1}</div>
                <div className="landing-step-num">{step.label}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <div className="landing-tags">{step.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-block landing-reveal" id="clusters">
        <div className="landing-shell">
          <div className="landing-section-eyebrow">Five causes, not one</div>
          <h2>Every red district is one of these patterns. The fix depends on which.</h2>
          <p className="landing-section-sub">A district stuck on language does not need more teachers; a teacher-shortage district does not need bilingual primers.</p>
          <div className="landing-cluster-grid">
            {clusters.map(([key, name, window, body, count], index) => (
              <div className={`landing-cluster-card landing-reveal landing-cluster-${key}`} style={{ transitionDelay: `${index * 70}ms` }} key={key}>
                <div className="landing-cluster-head"><span /><b>{name}</b></div>
                <div className="landing-cluster-window">{window}</div>
                <p>{body}</p>
                <div className="landing-cluster-count"><span>DISTRICTS</span><b>{count}</b></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-block landing-reveal" id="evidence">
        <div className="landing-shell">
          <div className="landing-section-eyebrow">Evidence engine</div>
          <h2>Every classification ships with the rows that justify it.</h2>
          <p className="landing-section-sub">No untraceable model output. For each district, EduSignal lists the evidence supporting or contradicting the proposed cause.</p>
          <div className="landing-evidence-wrap">
            <div>
              <div className="landing-district-pill"><span /> <b>Shravasti</b> - Uttar Pradesh</div>
              <h3>Hypothesis: Seasonal Migration</h3>
              <p>Confidence <b>0.91</b>, driven by NDVI seasonal variance, local news migration signal, and a Sep-Nov reading-score dip.</p>
            </div>
            <div className="landing-evidence-list">
              {evidence.map(([type, label, body, source, weight], index) => (
                <div className="landing-ev-row landing-reveal" style={{ transitionDelay: `${index * 80}ms` }} key={body}>
                  <span className={`landing-ev-tag landing-ev-${type}`}>{label}</span>
                  <p>{body}<small>{source}</small></p>
                  <b>{weight}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta landing-reveal">
        <div className="landing-shell">
          <h2>734 districts. One dashboard. The right answer for each.</h2>
          <p>Open EduSignal and start with the live overview, or jump straight to a district you care about via command search.</p>
          <div className="landing-hero-cta">
            <a href="/dashboard" className="landing-btn landing-btn-primary">Launch EduSignal <ArrowIcon /></a>
            <a href="/clusters" className="landing-btn landing-btn-ghost">Browse cause clusters</a>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-inner">
          <span>EDUSIGNAL - ROOT-CAUSE INTEL - v1.4</span>
          <span>Built on ASER - UDISE+ - ISRO Bhuvan - UPSESSB - PM-POSHAN</span>
          <a href="/dashboard">open dashboard</a>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
