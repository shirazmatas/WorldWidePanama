import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Laws from "./pages/Laws"; // You'll create these pages
import Government from "./pages/Government";

export default function App() {
    return (
        <Router>
            <Navbar />
            <main id="top">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/laws" element={<Laws />} />
                    <Route path="/government-structure" element={<Government />} />
                    <Route path="/profile" element={<Profile />} />
                </Routes>
            </main>
            <Footer />
        </Router>
    );
}

export default App
