// app/page.tsx
import { SearchBar } from "@/components/search/search-bar";
import { Header } from "@/components/layout/header";
import { StockWidgetsSection } from "@/components/market/stock-widgets-section";

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/img_bg.png')",
          opacity: 0.2,
          zIndex: -1, 
        }}
      ></div>

      <Header />

      <main className="w-full px-4 py-20 relative z-10">
        <section className="text-center mb-4">
          <h1 className="text-black text-4xl md:text-6xl font-extrabold mb-4 text-balance">
            PREDICT STOCK PRICE
            <span className="text-cyan-900"> SMART</span>
          </h1>
          <p className="text-black text-xl font-extrabold mb-4 text-pretty max-w-2xl mx-auto py-5">
            Analyze stock market with AI, track price trends and get accurate predictions
          </p>
          <div className="max-w-2xl mx-auto py-4">
            <SearchBar />
          </div>
        </section>
        
        <StockWidgetsSection />
      </main>
    </div>
  );
}