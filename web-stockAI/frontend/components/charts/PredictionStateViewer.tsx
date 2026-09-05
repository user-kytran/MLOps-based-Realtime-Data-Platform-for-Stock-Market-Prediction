"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


interface PredictionStateViewerProps {
  symbol: string;
  stateText?: string | null;
  decision?: string | null;
  confidenceScore?: number | null;
  predictionDate?: string | null;
}

export function PredictionStateViewer({
  symbol,
  stateText,
  decision,
  confidenceScore,
  predictionDate,
}: PredictionStateViewerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  if (!stateText && !decision) {
    return (
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm mt-4">
        <CardHeader className="py-3 px-4 border-b border-gray-100">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900">
            AI Investment Analysis & State Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-center text-gray-500 text-xs">
          Detailed AI analysis report is not yet available for {symbol}.
        </CardContent>
      </Card>
    );
  }

  const getDecisionBadge = (dec?: string | null) => {
    const d = (dec || "").toUpperCase();
    if (d.includes("BUY") || d.includes("OVERWEIGHT")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300 shadow-xs">
          {dec || "Buy"}
        </span>
      );
    }
    if (d.includes("SELL") || d.includes("UNDERWEIGHT")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shadow-xs">
          {dec || "Sell"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
        {dec || "Hold"}
      </span>
    );
  };

  // Simple, robust Markdown parser for LLM report structure
  const renderMarkdownContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    const flushTable = (key: string) => {
      if (tableBuffer.length < 2) {
        tableBuffer = [];
        inTable = false;
        return null;
      }

      const headerRow = tableBuffer[0];
      const dataRows = tableBuffer.slice(2); // Skip separator row

      const parseCells = (rowStr: string) =>
        rowStr
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1 || (idx === 0 && c !== "") || (idx === arr.length - 1 && c !== ""));

      const headers = parseCells(headerRow);

      const tableElement = (
        <div key={key} className="overflow-x-auto my-3 rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-bold text-gray-800 tracking-wider border-r last:border-r-0 border-gray-200"
                  >
                    {renderInlineFormatted(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dataRows.map((r, rowIdx) => {
                const cells = parseCells(r);
                return (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {cells.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="px-3 py-2 text-gray-700 whitespace-pre-wrap border-r last:border-r-0 border-gray-200"
                      >
                        {renderInlineFormatted(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

      tableBuffer = [];
      inTable = false;
      return tableElement;
    };

    const renderInlineFormatted = (text: string): React.ReactNode => {
      // Bold + italic or bold
      const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
      return parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-bold text-gray-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={idx} className="italic text-gray-700">
              {part.slice(1, -1)}
            </em>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={idx} className="bg-gray-100 text-purple-700 px-1 py-0.5 rounded text-[11px] font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Check for table lines
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        inTable = true;
        tableBuffer.push(trimmed);
        return;
      } else if (inTable) {
        const tableNode = flushTable(`table-${index}`);
        if (tableNode) elements.push(tableNode);
      }

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`space-${index}`} className="h-1.5" />);
        return;
      }

      // Blockquotes (> text)
      if (trimmed.startsWith(">")) {
        const quoteText = trimmed.replace(/^>\s*/, "");
        elements.push(
          <blockquote
            key={`quote-${index}`}
            className="my-2 p-2.5 border-l-4 border-amber-400 bg-amber-50/60 rounded-r-md text-xs text-amber-900 leading-relaxed"
          >
            {renderInlineFormatted(quoteText)}
          </blockquote>
        );
        return;
      }

      // Headings
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h4 key={`h3-${index}`} className="text-sm font-bold text-gray-900 mt-3 mb-1.5 flex items-center gap-1.5">
            {renderInlineFormatted(trimmed.slice(4))}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h3 key={`h2-${index}`} className="text-base font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-100">
            {renderInlineFormatted(trimmed.slice(3))}
          </h3>
        );
        return;
      }

      // Bullet lists (- item or * item)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const itemText = trimmed.slice(2);
        elements.push(
          <li key={`li-${index}`} className="ml-4 list-disc text-xs text-gray-700 my-0.5 leading-relaxed">
            {renderInlineFormatted(itemText)}
          </li>
        );
        return;
      }

      // Numbered lists (1. item)
      if (/^\d+\.\s/.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\.\s*/, "");
        elements.push(
          <li key={`oli-${index}`} className="ml-4 list-decimal text-xs text-gray-700 my-0.5 leading-relaxed">
            {renderInlineFormatted(itemText)}
          </li>
        );
        return;
      }

      // Regular paragraph
      elements.push(
        <p key={`p-${index}`} className="text-xs text-gray-700 my-1 leading-relaxed">
          {renderInlineFormatted(trimmed)}
        </p>
      );
    });

    if (inTable) {
      const tableNode = flushTable(`table-end`);
      if (tableNode) elements.push(tableNode);
    }

    return elements;
  };

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm mt-4">
      <CardHeader className="py-2.5 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold text-gray-900">
            AI Trading Plan & Debate Analysis (State)
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {predictionDate && (
            <span className="text-[11px] font-medium text-gray-500 font-mono">
              Date: {predictionDate}
            </span>
          )}
          {getDecisionBadge(decision)}
          {stateText && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-semibold text-cyan-800 hover:text-cyan-900 bg-cyan-50 border border-cyan-200 rounded px-2 py-0.5 cursor-pointer ml-1"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className={`p-4 space-y-2 font-sans transition-all duration-200 ${
        isExpanded ? "max-h-none" : "max-h-[250px] overflow-y-auto pr-2"
      }`}>
        {stateText ? (
          renderMarkdownContent(stateText)
        ) : (
          <div className="text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Recommendation: {decision || "N/A"}</p>
            {confidenceScore !== null && confidenceScore !== undefined && (
              <p className="mt-1">Model Confidence: {(confidenceScore * 100).toFixed(1)}%</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

