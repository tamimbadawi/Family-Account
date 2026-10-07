"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Drawer as DrawerPrimitive } from "vaul";
import { ColorIconPicker } from "@/components/settings/ColorIconPicker";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export type CategoryLevel = "category" | "subcategory" | "item";

export interface CategoryFormValues {
  nameAr: string | null;
  nameEn: string | null;
  color: string;
  icon: string;
}

export interface CategoryFormInitial {
  nameAr?: string | null;
  nameEn?: string | null;
  color?: string | null;
  icon?: string | null;
}

export const DEFAULT_CATEGORY_COLOR = "#0F766E";
export const DEFAULT_CATEGORY_ICON = "tag";

export interface CategoryFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: CategoryLevel;
  title: string;
  /** Values to start from; empty for "add". Read each time the drawer opens. */
  initial?: CategoryFormInitial;
  onSave: (values: CategoryFormValues) => void | Promise<void>;
  /** Opened from inside another drawer (the entry sheet). */
  nested?: boolean;
  /** Extra controls under the fields (e.g. archive). */
  children?: React.ReactNode;
}

/**
 * The add/edit form for a category, subcategory or item: both names, plus
 * colour and icon for categories. Shared by Settings → Categories and the
 * "+ New" chip in the entry sheet so both look and behave the same.
 */
export function CategoryFormDrawer({
  open,
  onOpenChange,
  level,
  title,
  initial,
  onSave,
  nested = false,
  children,
}: CategoryFormDrawerProps) {
  const t = useTranslations("settings");

  const [nameAr, setNameAr] = React.useState("");
  const [nameEn, setNameEn] = React.useState("");
  const [color, setColor] = React.useState(DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = React.useState(DEFAULT_CATEGORY_ICON);
  const [saving, setSaving] = React.useState(false);

  // Load the starting values each time the drawer opens
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNameAr(initial?.nameAr ?? "");
      setNameEn(initial?.nameEn ?? "");
      setColor(initial?.color || DEFAULT_CATEGORY_COLOR);
      setIcon(initial?.icon || DEFAULT_CATEGORY_ICON);
      setSaving(false);
    }
  }

  const canSave = !saving && (nameAr.trim() !== "" || nameEn.trim() !== "");

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        nameAr: nameAr.trim() || null,
        nameEn: nameEn.trim() || null,
        color,
        icon,
      });
    } finally {
      setSaving(false);
    }
  };

  const Root = nested ? DrawerPrimitive.NestedRoot : Drawer;

  return (
    <Root open={open} onOpenChange={onOpenChange}>
      {/* Scroll an inner box, not the sheet: vaul's filler below the sheet would scroll over the buttons */}
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto overscroll-contain px-5 pb-8">
          <DrawerHeader className="px-0 pt-4 pb-2">
            <DrawerTitle className="text-title font-bold text-ink text-start">
              {title}
            </DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 pt-2">
            {/* Arabic Name */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t("nameAr")}
              </label>
              <input
                type="text"
                dir="rtl"
                aria-label={t("nameAr")}
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder={t("nameArPlaceholder")}
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-line/50 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* English Name */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t("nameEn")}
              </label>
              <input
                type="text"
                dir="ltr"
                aria-label={t("nameEn")}
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder={t("nameEnPlaceholder")}
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-line/50 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Color & Icon picker for categories only */}
            {level === "category" && (
              <ColorIconPicker
                selectedColor={color}
                selectedIcon={icon}
                onSelectColor={setColor}
                onSelectIcon={setIcon}
              />
            )}

            {children}

            {/* Action Buttons */}
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-13 rounded-2xl bg-surface-2 text-ink font-semibold active:scale-95 transition-all cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="flex-1 h-13 rounded-2xl bg-accent text-accent-ink font-semibold shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Root>
  );
}
