import { Link } from "react-router-dom";

export default function Navbar() {
    return (
        <header className="navbar">
            <div className="nav-inner">
                <Link className="brand" to="/" aria-label="Panama Nation home">
                    <img src="/panama-president-flag.svg" alt="Flag of Panama President" className="brand-mark" />
                    <span className="brand-text">
            <strong>Kingdom of Panama</strong>
            <small>Pro Mundi Beneficio</small>
          </span>
                </Link>

                <nav className="nav-links" aria-label="Primary">
                    <a href="/#blog">Blog</a>
                    <a href="/#shops">Shops</a>
                    <a href="/#map">Dynmap</a>
                    <Link to="/laws">Laws</Link>
                    <Link to="/government-structure">Government</Link>
                    <Link to="/bank">Bank</Link>
                </nav>

                <div className="auth-slot">
                    {/* Points to the Express API route we defined earlier */}
                    <a className="btn btn-primary" href="/api/auth/discord">Login with Discord</a>
                </div>
            </div>
        </header>
    );
}