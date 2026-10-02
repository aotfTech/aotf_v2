"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { CreditCard, Sparkles } from "lucide-react";
import { PLANS, type PlanValue } from "./types";

interface PaymentStepProps {
  plan: PlanValue | "";
  isPaymentLoading: boolean;
  paymentError: string | null;
  onPay: () => void;
  /** True while profile/onboarding details are still saving */
  isSavingDetails?: boolean;
  /** True for users migrated from the legacy system who already paid */
  isLegacyMigrated?: boolean;
}

export default function PaymentStep({
  plan,
  isPaymentLoading,
  paymentError,
  onPay,
  isSavingDetails = false,
  isLegacyMigrated = false,
}: PaymentStepProps) {
  const selectedPlan = PLANS.find((p) => p.value === plan);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-center">
        {isLegacyMigrated ? "Activate Your Account" : "Complete Payment"}
      </h2>

      {/* ── Legacy-migration banner ──────────────────────────────────── */}
      {isLegacyMigrated && (
        <Card className="border border-success-200 bg-success-50">
          <CardBody className="space-y-1 text-sm">
            <p className="font-semibold text-success-700">
              🎉 Welcome back! Your previous payment is on record.
            </p>
            <p className="text-success-600">
              You&apos;ve already paid for AOTF on our previous platform. No
              payment is required — just click <strong>Activate Account</strong>{" "}
              to complete your setup.
            </p>
          </CardBody>
        </Card>
      )}

      {/* ── Normal plan summary (only for non-migrated users) ─────────── */}
      {!isLegacyMigrated && selectedPlan && (
        <Card className="border border-default-200 bg-background/60 backdrop-blur-md shadow-sm">
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-default-100">
              <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Order Summary</h3>
                <p className="text-xs text-default-500">Review your plan details</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-default-500">Plan</span>
                <span className="font-medium text-foreground">{selectedPlan.label}</span>
              </div>
              <div className="flex justify-between items-start text-sm pt-2 border-t border-default-100">
                <span className="text-default-500 mt-1">Amount</span>
                <div className="flex flex-col items-end">
                  <span className="font-bold text-xl text-foreground leading-none">
                    {selectedPlan.display}
                  </span>
                  <span className="text-[10px] font-medium text-success-600 bg-success-50 dark:bg-success-500/10 dark:text-success-500 px-2 py-0.5 rounded-full mt-1.5 border border-success-200 dark:border-success-500/20">
                    One-time payment
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {isSavingDetails && (
        <p className="text-sm text-default-500 text-center">
          Saving your details, please wait…
        </p>
      )}

      {paymentError && (
        <p className="text-sm text-danger text-center">{paymentError}</p>
      )}

      <Button
        fullWidth
        color={isLegacyMigrated ? "primary" : "success"}
        className={
          isLegacyMigrated
            ? ""
            : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/30 font-medium border-0"
        }
        size="lg"
        isLoading={isPaymentLoading || isSavingDetails}
        isDisabled={!selectedPlan || isPaymentLoading || isSavingDetails}
        onPress={onPay}
      >
        {isPaymentLoading ? (
          "Activating…"
        ) : isSavingDetails ? (
          "Please wait…"
        ) : isLegacyMigrated ? (
          "Activate Account"
        ) : (
          <span className="flex items-center gap-2">
            Pay {selectedPlan?.display ?? ""}
            <Sparkles className="w-4 h-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
