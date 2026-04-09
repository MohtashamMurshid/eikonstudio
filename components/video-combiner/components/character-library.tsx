"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, Edit2, Trash2, User, Check } from "lucide-react";
import type { Character } from "../types";
import { CharacterModal } from "./character-modal";

interface CharacterLibraryProps {
  selectedCharacters: Character[];
  onToggleCharacter: (character: Character) => void;
  maxSelection?: number;
}

export function CharacterLibrary({
  selectedCharacters,
  onToggleCharacter,
  maxSelection = 3,
}: CharacterLibraryProps) {
  const characters = useQuery(api.characters.getMyCharacters) as Character[] | undefined;
  const deleteCharacter = useMutation(api.characters.deleteCharacter);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isSelected = (char: Character) =>
    selectedCharacters.some((c) => c._id === char._id);

  const handleToggle = (char: Character) => {
    if (isSelected(char)) {
      onToggleCharacter(char);
      return;
    }
    if (selectedCharacters.length >= maxSelection) return;
    onToggleCharacter(char);
  };

  const handleDelete = async (char: Character) => {
    setDeletingId(char._id);
    try {
      await deleteCharacter({ characterId: char._id });
      if (isSelected(char)) onToggleCharacter(char);
    } catch (err) {
      console.error("Failed to delete character:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (char: Character) => {
    setEditingChar(char);
    setModalOpen(true);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider">
          Soul Cast
        </h3>
        <button
          onClick={() => { setEditingChar(null); setModalOpen(true); }}
          className="p-1 rounded-xl hover:bg-secondary/40 text-foreground/35 hover:text-foreground transition-all duration-200"
          title="Create character"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected characters pills */}
      {selectedCharacters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {selectedCharacters.map((char) => (
            <button
              key={char._id}
              onClick={() => onToggleCharacter(char)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-foreground/8 border border-foreground/15 text-xs text-foreground hover:bg-foreground/12 transition-all duration-200"
            >
              {char.avatarUrl ? (
                <img src={char.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <User className="w-3 h-3 text-foreground/40" />
              )}
              <span className="truncate max-w-[80px]">{char.name}</span>
              <span className="text-foreground/25 ml-0.5">×</span>
            </button>
          ))}
          <span className="text-[10px] text-foreground/25 self-center">
            {selectedCharacters.length}/{maxSelection}
          </span>
        </div>
      )}

      {/* Character list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto pr-0.5">
        {characters === undefined ? (
          <div className="py-4 text-center">
            <div className="w-4 h-4 border-2 border-foreground/15 border-t-foreground/50 rounded-full animate-spin mx-auto" />
          </div>
        ) : characters.length === 0 ? (
          <button
            onClick={() => { setEditingChar(null); setModalOpen(true); }}
            className="w-full py-4 border border-dashed border-border/50 rounded-xl text-xs text-foreground/35 hover:text-foreground/55 hover:border-foreground/25 transition-all duration-200 text-center"
          >
            Create your first character
          </button>
        ) : (
          characters.map((char) => {
            const selected = isSelected(char);
            const atLimit = !selected && selectedCharacters.length >= maxSelection;
            return (
              <div
                key={char._id}
                className={`group flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  selected
                    ? "bg-foreground/8 border border-foreground/15"
                    : atLimit
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-secondary/30 border border-transparent"
                }`}
                onClick={() => !atLimit && handleToggle(char)}
              >
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-secondary/30 flex items-center justify-center overflow-hidden">
                    {char.avatarUrl ? (
                      <img src={char.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-foreground/25" />
                    )}
                  </div>
                  {selected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{char.name}</p>
                  {char.archetype && (
                    <p className="text-[10px] text-foreground/35 truncate">{char.archetype}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(char); }}
                    className="p-1 rounded-lg hover:bg-secondary/50 text-foreground/35 hover:text-foreground"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(char); }}
                    disabled={deletingId === char._id}
                    className="p-1 rounded-lg hover:bg-red-500/15 text-foreground/35 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <CharacterModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingChar(null); }}
        editingCharacter={editingChar}
      />
    </div>
  );
}
