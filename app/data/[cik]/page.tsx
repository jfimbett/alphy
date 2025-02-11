// app/data/[cik]/page.tsx
export const dynamic = "force-dynamic";
import { CompanyFactsPage } from "@/components/ui/company-facts-page";

interface CompanyDataPageProps {
  params: {
    cik: string;
  };
}



export default async function CompanyDataPage({ params }: CompanyDataPageProps) {
  const { cik } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">
          Company Financial Facts & Info
        </h1>

        {/* Our client component with all the logic */}
        <CompanyFactsPage cik={cik} />
      </main>
    </div>
  );
}
