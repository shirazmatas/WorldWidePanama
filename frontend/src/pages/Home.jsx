import Hero from "../components/Hero";
import FeatureBlock from "../components/FeatureBlock";
import BlogList from "../components/BlogList";
import MapFrame from "../components/MapFrame";

export default function Home() {
    return (
        <>
            <Hero />
            <FeatureBlock
                eyebrow="Overview"
                title="In Panama we have something for everybody."
                text="This section is a good place to describe claims, structure, and the goals for Panama..."
                image="/panama-flag.svg"
            />

            {/* Sections for Shops, Blog, and Map go here */}
            <section className="section-grid">
                <BlogList />
                <MapFrame />
            </section>

            <section className="join">
                <p className="eyebrow">Discord</p>
                <h2>Login, coordinate, and keep the nation active.</h2>
                <a href="/api/auth/discord">Login with Discord</a>
            </section>
        </>
    );
}