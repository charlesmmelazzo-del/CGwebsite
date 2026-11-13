"use client";

import { useEffect, useState } from "react";
import type { EventBooking } from "@/lib/reserve/types";
import { dateLong, opensAtLabel, telHref } from "@/lib/reserve/format";
import BookingFlow from "./BookingFlow";
import { api, ApiError, GENERIC_ERROR, Loading, Modal, RvRoot, SkeletonRow, type RvTheme } from "./ui";

/**
 * Booking for one event, opened from the Events page: a full-screen sheet on
 * phones. Loads the event's own party range, tables and policies from the Bible.
 */
export default function EventBookingModal({
  websiteEventId,
  title,
  open,
  onClose,
  phone,
  theme,
}: {
  websiteEventId: string;
  title: string;
  open: boolean;
  onClose: () => void;
  phone: string;
  theme: RvTheme;
}) {
  const [booking, setBooking] = useState<EventBooking | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setBooking(null);
    setError("");
    api<EventBooking>(`/api/reserve/events/${encodeURIComponent(websiteEventId)}`, { signal: ctrl.signal })
      .then(setBooking)
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : GENERIC_ERROR);
      });
    return () => ctrl.abort();
  }, [open, websiteEventId]);

  const name = booking?.title || title;
  const ready =
    booking?.state === "open" && booking.party?.min != null && booking.party?.max != null && booking.date;

  return (
    <RvRoot theme={theme}>
      <Modal
        open={open}
        onClose={onClose}
        size="full"
        title={
          <>
            Reserve a table for {name}
            {booking?.date && (
              <span className="block text-sm mt-1 opacity-75" style={{ fontFamily: "var(--font-body, inherit)", letterSpacing: 0 }}>
                {dateLong(booking.date)}
              </span>
            )}
          </>
        }
      >
        <div className="pt-2 pb-6">
          {error ? (
            <p role="alert">
              {error}{" "}
              <a className="rv-link" href={telHref(phone)}>
                {phone}
              </a>
            </p>
          ) : !booking ? (
            <>
              <Loading label="Loading the event" />
              <SkeletonRow count={3} w={120} />
              <div className="mt-6">
                <SkeletonRow count={6} />
              </div>
            </>
          ) : ready ? (
            <BookingFlow
              party={{ min: booking.party!.min!, max: booking.party!.max! }}
              policies={booking.policies ?? []}
              phone={phone}
              defaultParty={2}
              event={{ websiteId: websiteEventId, eventId: booking.event_id, title: name, date: booking.date }}
            />
          ) : booking.state === "scheduled" && booking.opens_at ? (
            <p>Reservations open {opensAtLabel(booking.opens_at)}.</p>
          ) : booking.state === "pending" ? (
            <p>Check back soon to reserve a table.</p>
          ) : (
            <p>
              Reservations for this event are closed. Questions? Call us at{" "}
              <a className="rv-link" href={telHref(phone)}>
                {phone}
              </a>
              .
            </p>
          )}
        </div>
      </Modal>
    </RvRoot>
  );
}
