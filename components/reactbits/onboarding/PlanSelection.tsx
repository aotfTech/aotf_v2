"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { PLANS, type PlanValue } from "./types";

interface PlanSelectionProps {
  selectedPlan: PlanValue | "";
  onPlanChange: (plan: PlanValue) => void;
  isSaving: boolean;
  isSavingOnboarding: boolean;
  saveError: string | null;
  onRetryProfile: () => void;
  onboardingDetailsError: string | null;
  onRetryOnboarding: () => void;
}

export default function PlanSelection({
  selectedPlan,
  onPlanChange,
  isSaving,
  isSavingOnboarding,
  saveError,
  onRetryProfile,
  onboardingDetailsError,
  onRetryOnboarding,
}: PlanSelectionProps) {
  return (
    <div className="space-y-4">
      {/* Save status banners */}
      {/* {(isSaving || isSavingOnboarding) && (
        <p className="text-sm text-default-500 text-center">
          Saving your details…
        </p>
      )} */}
      {saveError && (
        <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 text-danger text-sm flex items-center justify-between gap-3">
          <span>{saveError}</span>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            onPress={onRetryProfile}
            isLoading={isSaving}
          >
            Retry
          </Button>
        </div>
      )}
      {onboardingDetailsError && (
        <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 text-danger text-sm flex items-center justify-between gap-3">
          <span>{onboardingDetailsError}</span>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            onPress={onRetryOnboarding}
            isLoading={isSavingOnboarding}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.value;
          return (
            <Card
              key={plan.value}
              isPressable
              isHoverable
              className={`relative border-2 transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary-50/50 shadow-md shadow-primary/20"
                  : "border-default-200 hover:border-primary/50"
              }`}
              onPress={() => onPlanChange(plan.value)}
            >
              <CardBody className="flex flex-row items-center gap-4 p-4">
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  ) : (
                    <Circle className="w-6 h-6 text-default-300" />
                  )}
                </div>
                <div className="flex flex-col flex-1 items-start text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-1">
                    <span className="font-bold text-lg text-foreground">
                      {plan.label}
                    </span>
                    <span className="font-semibold text-lg text-primary">
                      {plan.display}
                    </span>
                  </div>
                  <span className="text-sm text-default-500 mt-1">
                    {plan.description}
                  </span>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
