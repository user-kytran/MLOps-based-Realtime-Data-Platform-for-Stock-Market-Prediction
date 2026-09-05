"use client"

import React, { useEffect } from "react"
import { useOnboarding } from "@/lib/onboardingContext"

export function GuideTour() {
  const {
    isTourOpen,
    currentStepIndex,
    totalSteps,
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    finishTour,
  } = useOnboarding()

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTourOpen) return
      if (e.key === "Escape") {
        skipTour()
      } else if (e.key === "ArrowRight") {
        nextStep()
      } else if (e.key === "ArrowLeft") {
        prevStep()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isTourOpen, nextStep, prevStep, skipTour])

  if (!isTourOpen) return null

  const isLastStep = currentStepIndex === totalSteps - 1

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-end justify-center sm:justify-end p-3 sm:p-5 pointer-events-none animate-in fade-in-0 duration-200">
      {/* Light transparent backdrop - subtle scrim allowing the underlying page and charts to be 100% visible */}
      <div
        className="fixed inset-0 bg-slate-950/15 backdrop-blur-[0.5px] transition-opacity pointer-events-auto"
        onClick={skipTour}
      />

      {/* Floating Tour Guide Card - Translucent Glassmorphism placed at bottom corner to avoid obstructing charts */}
      <div className="relative w-full max-w-lg rounded-xl bg-white/92 backdrop-blur-lg p-4 sm:p-5 shadow-2xl border border-gray-200/90 z-10 animate-in slide-in-from-bottom-3 duration-200 pointer-events-auto text-gray-900">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-md border font-medium text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 border-gray-200">
              {currentStep.badge}
            </span>
            {currentStep.activeTab ? (
              <span className="inline-flex items-center rounded-md border font-medium text-[10px] px-1.5 py-0.2 bg-cyan-50 text-cyan-800 border-cyan-200 uppercase">
                Tab: {currentStep.activeTab}
              </span>
            ) : (
              <span className="text-[11px] font-mono text-cyan-800">
                {currentStep.targetRoute}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={skipTour}
            className="text-[11px] font-mono text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Skip tour"
          >
            esc
          </button>
        </div>

        {/* Step Progress Segmented Bar */}
        <div className="mt-2.5 flex items-center gap-1">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToStep(index)}
              className={`h-1.5 flex-1 rounded-full transition-all duration-200 cursor-pointer ${
                index === currentStepIndex
                  ? "bg-cyan-700"
                  : index < currentStepIndex
                  ? "bg-cyan-200"
                  : "bg-gray-200"
              }`}
              title={`Step ${index + 1} of ${totalSteps}`}
            />
          ))}
        </div>

        {/* Main Content */}
        <div className="mt-3">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
            {currentStep.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentStep.subtitle}
          </p>

          <p className="mt-2 text-xs text-gray-600 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Highlights List */}
          {currentStep.highlights && currentStep.highlights.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-gray-200/80 bg-gray-50/60 p-2.5 space-y-1">
              <ul className="space-y-1">
                {currentStep.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-xs text-gray-700 leading-normal">
                    <span className="text-cyan-700 font-bold shrink-0 mt-0.5">&bull;</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-3.5 pt-2 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={skipTour}
            className="text-xs text-gray-400 hover:text-gray-700 px-1 py-1 transition-colors cursor-pointer"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center justify-center rounded-md border text-[11px] font-medium bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 shadow-xs h-7 px-2.5 transition-colors cursor-pointer"
              >
                &larr; Back
              </button>
            )}

            <button
              type="button"
              onClick={isLastStep ? finishTour : nextStep}
              className="inline-flex items-center justify-center rounded-md border text-[11px] font-semibold bg-cyan-700 text-white border-cyan-800 hover:bg-cyan-800 shadow-xs h-7 px-3 transition-all cursor-pointer"
            >
              {isLastStep ? "Finish tour" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
