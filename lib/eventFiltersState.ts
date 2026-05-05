import { EVENT_STATUS_OPTIONS } from "@/lib/constants";

export interface EventFiltersState {
  query: string;
  city: string;
  category: string;
  freeOnly: boolean;
  ageKeyword: string;
  indoorOutdoor: "" | "Indoor" | "Outdoor";
  registrationRequired: "" | "yes" | "no";
  status: "" | (typeof EVENT_STATUS_OPTIONS)[number];
  sourceType: string;
  calendarAdded: "" | "yes" | "no";
}

export const defaultEventFilters: EventFiltersState = {
  query: "",
  city: "",
  category: "",
  freeOnly: false,
  ageKeyword: "",
  indoorOutdoor: "",
  registrationRequired: "",
  status: "",
  sourceType: "",
  calendarAdded: "",
};
