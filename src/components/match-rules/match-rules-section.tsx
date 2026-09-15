import type { RuleSectionProps } from "./shared";
import { FinalSetSection } from "./final-set-section";
import { MatchBasicsSection } from "./match-basics-section";
import { TieBreakSection } from "./tie-break-section";

export const MatchRulesSection = ({ isDisabled, prefix }: RuleSectionProps) => (
  <>
    <MatchBasicsSection isDisabled={isDisabled} prefix={prefix} />
    <TieBreakSection isDisabled={isDisabled} prefix={prefix} />
    <FinalSetSection isDisabled={isDisabled} prefix={prefix} />
  </>
);
