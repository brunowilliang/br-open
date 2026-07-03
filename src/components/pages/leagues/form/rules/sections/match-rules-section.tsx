import type { RuleSectionProps } from "../shared";
import { FinalSetSection } from "./final-set-section";
import { MatchBasicsSection } from "./match-basics-section";
import { TieBreakSection } from "./tie-break-section";

export const MatchRulesSection = ({ isDisabled }: RuleSectionProps) => (
  <>
    <MatchBasicsSection isDisabled={isDisabled} />
    <TieBreakSection isDisabled={isDisabled} />
    <FinalSetSection isDisabled={isDisabled} />
  </>
);
