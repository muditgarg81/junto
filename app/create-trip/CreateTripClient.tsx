'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createTripAction } from './actions';
import { ArrowLeft, MapPin, Calendar, Coins } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { User as UserType } from '@/lib/types';

interface CreateTripClientProps {
  user: UserType;
}

export default function CreateTripClient({ user }: CreateTripClientProps) {
  const router = useRouter();
  const [addDatesLater, setAddDatesLater] = useState(false);
  const [isPending, startTransition] = useTransition();

  const formAction = async (formData: FormData) => {
    formData.append('addDatesLater', String(addDatesLater));
    startTransition(async () => {
      const res = await createTripAction(null, formData);
      if (res.error) {
        alert(res.error);
      } else if (res.success && res.tripId) {
        router.push(`/trip/${res.tripId}/invite`);
      }
    });
  };

  return (
    <div className="relative min-h-screen bg-surface flex flex-col justify-between px-6 py-6 overflow-x-hidden max-w-md mx-auto border-x border-border-warm-grey shadow-sm">
      {/* Background Gradient Washes */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#ffdbcf] rounded-full blur-[100px] opacity-45 pointer-events-none" />

      {/* Main Form Container */}
      <div className="w-full flex-grow z-10">
        {/* App Bar */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-ink-text hover:text-secondary transition p-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="font-headline-md text-ink-text">New trip</h1>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          
          {/* Trip Name Card */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl space-y-2 shadow-sm">
            <label htmlFor="tripName" className="flex items-center gap-1.5 font-label-caps text-muted-text">
              Trip Name
            </label>
            <input
              type="text"
              id="tripName"
              name="tripName"
              placeholder="e.g. Goa · January"
              required
              className="w-full bg-transparent text-ink-text font-body-md border-b border-transparent focus:border-outline outline-none py-1 transition duration-200"
            />
          </div>

          {/* Destination Card */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl space-y-2 shadow-sm">
            <label htmlFor="destination" className="flex items-center gap-1.5 font-label-caps text-muted-text">
              <MapPin className="w-3.5 h-3.5" />
              Destination
            </label>
            <input
              type="text"
              id="destination"
              name="destination"
              placeholder="e.g. Goa, India"
              className="w-full bg-transparent text-ink-text font-body-md border-b border-transparent focus:border-outline outline-none py-1 transition duration-200"
            />
          </div>

          {/* Dates Card */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-label-caps text-muted-text">
                <Calendar className="w-3.5 h-3.5" />
                Dates
              </label>
              <button
                type="button"
                onClick={() => setAddDatesLater(!addDatesLater)}
                className={`font-body-sm px-2.5 py-1 rounded-full border transition duration-200 ${
                  addDatesLater
                    ? 'bg-primary-container text-surface-container-lowest border-transparent'
                    : 'border-border-warm-grey text-muted-text hover:text-ink-text'
                }`}
              >
                Add dates later
              </button>
            </div>

            {!addDatesLater && (
              <div className="grid grid-cols-2 gap-4 pt-1 transition duration-200">
                <div className="space-y-1">
                  <span className="font-label-caps text-muted-text text-[10px]">Start Date</span>
                  <input
                    type="date"
                    name="startDate"
                    required={!addDatesLater}
                    className="w-full bg-transparent text-ink-text font-body-md border-b border-border-warm-grey focus:border-outline outline-none py-1 transition duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <span className="font-label-caps text-muted-text text-[10px]">End Date</span>
                  <input
                    type="date"
                    name="endDate"
                    required={!addDatesLater}
                    className="w-full bg-transparent text-ink-text font-body-md border-b border-border-warm-grey focus:border-outline outline-none py-1 transition duration-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Currency Card */}
          <div className="bg-card-cream border border-border-warm-grey p-5 rounded-2xl space-y-2 shadow-sm">
            <label htmlFor="baseCurrency" className="flex items-center gap-1.5 font-label-caps text-muted-text">
              <Coins className="w-3.5 h-3.5" />
              Base Currency
            </label>
            <select
              id="baseCurrency"
              name="baseCurrency"
              defaultValue="INR"
              className="w-full bg-transparent text-ink-text font-body-md outline-none py-1 border-b border-transparent focus:border-outline transition duration-200 cursor-pointer"
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
              <option value="AED">AED</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-primary-container hover:bg-primary disabled:bg-outline-variant text-surface-container-lowest font-body-md font-semibold py-4 px-6 rounded-xl shadow-sm transition duration-200 mt-6"
          >
            {isPending ? 'Creating...' : 'Create & get invite link'}
          </button>
        </form>
      </div>

      {/* Footer Branding */}
      <div className="text-center font-body-sm text-muted-text py-4 z-10">
        {APP_NAME} Travel Companion
      </div>
    </div>
  );
}
