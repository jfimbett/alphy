// app/page.tsx
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { BarChart, CloudUpload, ShieldCheck } from 'lucide-react';
import AnalysisPreview from '@/components/AnalysisPreview';
import TestimonialsSlider from '@/components/TestimonialsSlider';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

export default function Home() {
  

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center py-20">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Transform Private Equity Analysis with <span className="text-blue-600">AI Insights</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Accelerate due diligence and uncover hidden opportunities with our AI-powered platform. Process documents 10x faster and make data-driven investment decisions.
          </p>
          <div className="flex justify-center gap-4 mb-12">
            <Link
              href="/login"
              className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 text-lg font-semibold"
            >
              Start Free Trial
            </Link>
            <Link
              href="/demo"
              className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 text-lg font-semibold"
            >
              Book Demo
            </Link>
          </div>

          <div className="flex justify-center gap-8 text-gray-600">
            <div className="flex items-center gap-2">
              <CloudUpload className="text-blue-600" size={20} />
              <span>Secure Document Upload</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart className="text-blue-600" size={20} />
              <span>Real-time Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={20} />
              <span>SOC 2 Certified</span>
            </div>
          </div>
        </div>


        {/* AI Value Proposition */}
        <div className="bg-white py-16 rounded-2xl shadow-lg mb-24 text-gray-600">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 ">Why AI in Private Equity?</h2>
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <p className="text-lg text-gray-600">
                  In today's competitive landscape, AI-powered analysis is no longer optional. Our platform helps you:
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600">✓</span>
                    </div>
                    Reduce due diligence time by 70%
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600">✓</span>
                    </div>
                    Identify 3x more potential risks
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600">✓</span>
                    </div>
                    Process 100+ document types automatically
                  </li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8">
                <div className="aspect-video bg-white rounded-lg shadow-md overflow-hidden">
                  <AnalysisPreview />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="py-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-600">Simple, Transparent Pricing</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow text-gray-600">
              <h3 className="text-2xl font-bold mb-4">Starter</h3>
              <p className="text-4xl font-bold mb-6">$0<span className="text-lg text-gray-500">/mo</span></p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-2">✓ 5 document analyses/month</li>
                <li className="flex items-center gap-2">✓ Basic risk detection</li>
                <li className="flex items-center gap-2">✓ Team of up to 3 users</li>
                <li className="flex items-center gap-2">✓ Email support</li>
              </ul>
              <Link href="/signup" className="w-full block text-center bg-gray-100 text-gray-800 py-3 rounded-lg hover:bg-gray-200">
                Get Started
              </Link>
            </div>
            {/* Pro Tier */}
            <div className="bg-blue-600 p-8 rounded-2xl shadow-lg transform scale-105 relative text-gray-600">
              <div className="absolute top-0 right-0 bg-yellow-400 text-black px-4 py-1 rounded-bl-xl text-sm font-semibold">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Professional</h3>
              <p className="text-4xl font-bold text-white mb-6">$499<span className="text-lg text-blue-100">/mo</span></p>
              <ul className="space-y-4 mb-8 text-blue-50">
                <li className="flex items-center gap-2">✓ 50 document analyses/month</li>
                <li className="flex items-center gap-2">✓ Advanced AI insights</li>
                <li className="flex items-center gap-2">✓ Custom reporting</li>
                <li className="flex items-center gap-2">✓ Priority support</li>
                <li className="flex items-center gap-2">✓ Team of up to 10 users</li>
              </ul>
              <Link href="/signup" className="w-full block text-center bg-white text-blue-600 py-3 rounded-lg hover:bg-gray-100">
                Start Free Trial
              </Link>
            </div>
            {/* Enterprise Tier */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow text-gray-600">
              <h3 className="text-2xl font-bold mb-4">Enterprise</h3>
              <p className="text-4xl font-bold mb-6">Custom</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-2">✓ Unlimited analysis</li>
                <li className="flex items-center gap-2">✓ Dedicated AI models</li>
                <li className="flex items-center gap-2">✓ SLA & 24/7 support</li>
                <li className="flex items-center gap-2">✓ Custom integrations</li>
                <li className="flex items-center gap-2">✓ On-premise options</li>
              </ul>
              <Link href="/contact" className="w-full block text-center bg-gray-800 text-white py-3 rounded-lg hover:bg-gray-700">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
         {/* Testimonials Section #!TODO not really looking nice
         <section className="my-16 container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6 text-center">What Our Customers Say</h2>
          <TestimonialsSlider />
        </section>
        */}
      </main>
    </div>
  );
}