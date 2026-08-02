"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Upload, User } from "lucide-react";
import type { Character, CharacterAppearance } from "../types";
import { GENRE_OPTIONS, ARCHETYPE_OPTIONS } from "../types";

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCharacter?: Character | null;
  onSaved?: () => void;
}

const EMPTY_APPEARANCE: CharacterAppearance = {
  gender: undefined,
  age: undefined,
  height: undefined,
  eyeColor: undefined,
  hairColor: undefined,
  hairStyle: undefined,
  skinTone: undefined,
  facialHair: undefined,
  build: undefined,
};

export function CharacterModal({ isOpen, onClose, editingCharacter, onSaved }: CharacterModalProps) {
  const createCharacter = useMutation(api.characters.createCharacter);
  const updateCharacter = useMutation(api.characters.updateCharacter);
  const generateUploadUrl = useMutation(api.characters.generateUploadUrl);

  const [name, setName] = useState(editingCharacter?.name ?? "");
  const [genre, setGenre] = useState(editingCharacter?.genre ?? "");
  const [archetype, setArchetype] = useState(editingCharacter?.archetype ?? "");
  const [appearance, setAppearance] = useState<CharacterAppearance>(
    editingCharacter?.appearance ?? { ...EMPTY_APPEARANCE }
  );
  const [outfit, setOutfit] = useState(editingCharacter?.outfit ?? "");
  const [details, setDetails] = useState(editingCharacter?.details ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    editingCharacter?.avatarUrl ?? null
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const updateAppearance = (key: keyof CharacterAppearance, value: string) => {
    setAppearance((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      let avatarStorageId = editingCharacter?.avatarStorageId;

      if (avatarFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": avatarFile.type },
          body: avatarFile,
        });
        const { storageId } = await res.json();
        avatarStorageId = storageId;
      }

      const charData = {
        name: name.trim(),
        genre: genre || undefined,
        archetype: archetype || undefined,
        appearance,
        outfit: outfit || undefined,
        details: details || undefined,
        avatarStorageId,
      };

      if (editingCharacter) {
        await updateCharacter({ characterId: editingCharacter._id, ...charData });
      } else {
        await createCharacter(charData);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save character:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl mx-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 pb-3 border-b border-border bg-card rounded-t-2xl">
          <h2 className="text-base font-semibold text-foreground">
            {editingCharacter ? "Edit Character" : "New Soul Cast Character"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-secondary/40 text-foreground/40 hover:text-foreground transition-all duration-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Avatar + Name row */}
          <div className="flex items-start gap-3">
            <label className="relative shrink-0 cursor-pointer group">
              <div className="w-16 h-16 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-foreground/30" />
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
            </label>
            <div className="flex-1">
              <label className="text-xs text-foreground/40 mb-1 block">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Character name..."
                className="w-full h-9 px-3 bg-secondary/20 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/15 transition-colors duration-200"
              />
            </div>
          </div>

          {/* Genre + Archetype */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-foreground/40 mb-1 block">Genre</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="h-9 bg-secondary/20 border-border/50 rounded-xl text-sm w-full">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g} className="text-sm">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-foreground/40 mb-1 block">Archetype</label>
              <Select value={archetype} onValueChange={setArchetype}>
                <SelectTrigger className="h-9 bg-secondary/20 border-border/50 rounded-xl text-sm w-full">
                  <SelectValue placeholder="Select archetype" />
                </SelectTrigger>
                <SelectContent>
                  {ARCHETYPE_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a} className="text-sm">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Appearance section */}
          <div>
            <label className="text-xs text-foreground/40 mb-2 block font-medium">Appearance</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["gender", "Gender", "Male, Female, Non-binary..."],
                ["age", "Age", "Young, Middle-aged, Elderly..."],
                ["build", "Build", "Athletic, Slim, Muscular..."],
                ["height", "Height", "Tall, Average, Short..."],
                ["eyeColor", "Eye Color", "Blue, Brown, Green..."],
                ["hairColor", "Hair Color", "Black, Blonde, Red..."],
                ["hairStyle", "Hair Style", "Short, Long, Braided..."],
                ["skinTone", "Skin Tone", "Fair, Tan, Dark..."],
                ["facialHair", "Facial Hair", "None, Beard, Stubble..."],
              ] as [keyof CharacterAppearance, string, string][]).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="text-[10px] text-foreground/35 mb-0.5 block">{label}</label>
                  <input
                    value={appearance[key] ?? ""}
                    onChange={(e) => updateAppearance(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-8 px-2.5 bg-secondary/15 border border-border/40 rounded-xl text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/15 transition-colors duration-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Outfit */}
          <div>
            <label className="text-xs text-foreground/40 mb-1 block">Outfit</label>
            <input
              value={outfit}
              onChange={(e) => setOutfit(e.target.value)}
              placeholder="Leather jacket, combat boots, silver necklace..."
              className="w-full h-9 px-3 bg-secondary/20 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/15 transition-colors duration-200"
            />
          </div>

          {/* Details */}
          <div>
            <label className="text-xs text-foreground/40 mb-1 block">Additional Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Scar across left eyebrow, walks with a limp..."
              rows={2}
              className="w-full px-3 py-2 bg-secondary/20 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-foreground/15 resize-none transition-colors duration-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-4 pt-3 border-t border-border bg-card rounded-b-2xl">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {saving ? "Saving..." : editingCharacter ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
