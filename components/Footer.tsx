'use client';

import Link from 'next/link';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-gray-100 text-gray-600">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-6 md:space-y-0">
          {/* Company Info */}
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-semibold">© 2023 AlphaGen SARSL. All rights reserved.</p>
            <p className="text-xs">
              Based in Luxembourg | License #12345
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-2">
            <h3 className="text-sm font-semibold mb-2">Quick Links</h3>
            <Link href="/about" className="text-xs hover:text-gray-900 transition-colors">
              About Us
            </Link>
            <Link href="/services" className="text-xs hover:text-gray-900 transition-colors">
              Our Services
            </Link>
            <Link href="/contact" className="text-xs hover:text-gray-900 transition-colors">
              Contact Us
            </Link>
            <Link href="/privacy-policy" className="text-xs hover:text-gray-900 transition-colors">
              Privacy Policy
            </Link>
          </nav>

          {/* Social Media Links */}
          <div className="flex flex-col space-y-2">
            <h3 className="text-sm font-semibold mb-2">Follow Us</h3>
            <div className="flex space-x-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaFacebook size={20} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaTwitter size={20} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaInstagram size={20} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaLinkedin size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="border-t border-gray-300 mt-6 pt-4 text-xs text-center">
          <p>
            Designed and built with ❤️ by{' '}
            <a
              href="https://yourcompany.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-900 transition-colors"
            >
              AlphaGen
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}