"use client";

import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { ArrowRight, Sparkles, UserCircle, Settings, Edit } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col items-center justify-center p-4 mb-15">
      {/* Top Navigation / Logout */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-2">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            Welcome to AOTF!
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto">
            We are thrilled to have you here. Before you can start exploring jobs, applying for tuitions, and managing your profile, we need to get to know you a bit better.
          </p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md">
          <CardHeader className="flex gap-3 justify-center pt-8 pb-4">
            <h2 className="text-2xl font-bold text-gray-800">Your Onboarding Journey</h2>
          </CardHeader>
          <CardBody className="px-8 pb-8 gap-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                <UserCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">1. Complete Your Profile</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Tell us about your background, subjects you teach, and your location. This helps us match you with the right opportunities.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">2. Set Your Preferences</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Let us know what kind of tuitions and job opportunities you are looking for so we can personalize your experience.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-2 bg-emerald-100 rounded-lg">
                <Edit className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">3. Edit Anytime</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Don&apos;t worry about getting it perfect! You can edit your entered details (except your name, username, and email) later from your profile page.
                </p>
              </div>
            </div>
          </CardBody>
          <CardFooter className="bg-gray-50/50 rounded-b-xl border-t border-gray-100 p-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <p className="text-sm text-gray-500 font-medium">
              Takes about 3-5 minutes
            </p>
            <Button
              as={Link}
              href="/onboarding"
              color="primary"
              variant="shadow"
              size="lg"
              endContent={<ArrowRight className="w-4 h-4 ml-1" />}
              className="w-full sm:w-auto font-semibold"
            >
              Start Onboarding
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
