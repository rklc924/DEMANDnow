import type { DeadlineSource } from "..";
import { demandSource } from "./demand";
import { lienSource } from "./liens";

// Every kind of matter that has dates. Add new ones here (for example landlord arrears: RTB and commercial).
export const SOURCES: DeadlineSource[] = [demandSource, lienSource];
