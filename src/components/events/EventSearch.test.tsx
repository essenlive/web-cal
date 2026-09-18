import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEventsStore, useUIStore } from "../../store";
import { EventSearch } from "./EventSearch";
import type { CalendarEvent } from "../../types";

/** Builds an ISO start time `offsetMs` away from the real current time, so
 *  proximity-to-today sorting can be asserted without mocking the system clock. */
function isoOffsetFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function makeEvent(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "title" | "start">): CalendarEvent {
  return {
    calendarId: "demo",
    eventTypeId: "",
    end: overrides.start,
    allDay: false,
    ...overrides,
  };
}

// Ordered here from closest to farthest from "now" — the order EventSearch's
// sortByRelevance is expected to produce for an empty query.
const MEETING = makeEvent({ id: "e-meeting", title: "Réunion équipe", location: "Salle A", start: isoOffsetFromNow(2 * HOUR) });
const BIRTHDAY = makeEvent({ id: "e-birthday", title: "Anniversaire Marie", location: "Chez Marie", start: isoOffsetFromNow(-1 * DAY) });
const BOOK_FAIR = makeEvent({ id: "e-book-fair", title: "Salon du Livre", location: "Palais des Congrès", start: isoOffsetFromNow(10 * DAY) });
const HIKE = makeEvent({ id: "e-hike", title: "Randonnée montagne", location: "Sommet du Puy", start: isoOffsetFromNow(-30 * DAY) });

const ALL_EVENTS = [MEETING, BIRTHDAY, BOOK_FAIR, HIKE];

function seedEvents(events: CalendarEvent[]) {
  useEventsStore.getState().setEvents(events);
}

async function openViaHeaderButton() {
  const user = userEvent.setup();
  const triggers = screen.getAllByRole("button", { name: "Rechercher un événement" });
  await user.click(triggers[0]);
  return user;
}

describe("EventSearch", () => {
  beforeEach(() => {
    useEventsStore.setState({ events: [], hasLoadedOnce: false });
    useUIStore.setState({ currentDate: new Date() });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens via the header search button", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);

    expect(screen.queryByPlaceholderText("Rechercher un événement (titre, lieu)…")).not.toBeInTheDocument();

    await openViaHeaderButton();

    expect(screen.getByPlaceholderText("Rechercher un événement (titre, lieu)…")).toBeInTheDocument();
  });

  it("opens via Ctrl/Cmd+K from anywhere", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(await screen.findByPlaceholderText("Rechercher un événement (titre, lieu)…")).toBeInTheDocument();
  });

  it("closes via Escape", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);
    const user = await openViaHeaderButton();

    expect(screen.getByPlaceholderText("Rechercher un événement (titre, lieu)…")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("Rechercher un événement (titre, lieu)…")).not.toBeInTheDocument();
  });

  it("sorts results by proximity to today's date when the query is empty", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);
    await openViaHeaderButton();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent(MEETING.title);
    expect(options[1]).toHaveTextContent(BIRTHDAY.title);
    expect(options[2]).toHaveTextContent(BOOK_FAIR.title);
    expect(options[3]).toHaveTextContent(HIKE.title);
  });

  it("filters results by title", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);
    const user = await openViaHeaderButton();

    await user.type(screen.getByPlaceholderText("Rechercher un événement (titre, lieu)…"), "Anniversaire");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(BIRTHDAY.title);
  });

  it("filters results by location", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);
    const user = await openViaHeaderButton();

    await user.type(screen.getByPlaceholderText("Rechercher un événement (titre, lieu)…"), "Puy");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(HIKE.title);
  });

  it("navigates to the chosen event: closes search, moves the calendar date and opens the event detail", async () => {
    seedEvents(ALL_EVENTS);
    render(<EventSearch />);
    const user = await openViaHeaderButton();

    await user.click(screen.getByText(BIRTHDAY.title));

    // Search dialog closes.
    expect(screen.queryByPlaceholderText("Rechercher un événement (titre, lieu)…")).not.toBeInTheDocument();

    // Calendar date moves to the selected event's start.
    expect(useUIStore.getState().currentDate.toISOString()).toBe(new Date(BIRTHDAY.start).toISOString());

    // Event detail opens for the selected event.
    expect(await screen.findByRole("dialog", { name: BIRTHDAY.title })).toBeInTheDocument();
  });
});
