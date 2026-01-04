# Eikon Feature Roadmap

## Overview

Four major features to build:
1. **Design Systems** - Extract style from reference images and generate consistent assets
2. **Folders** - Organize generated images, references, and design system assets
3. **Secure BYOK** - Encrypted API key storage (not just localStorage)
4. **Real Dashboard** - Actual usage stats, costs, and analytics

---

## 1. Design Systems with Reference Images

> Let users create design systems from reference images for consistent asset generation

### Backend
- [ ] Add `designSystems` table to Convex schema
  - userId, name, description
  - referenceImages (array of base64)
  - extractedStyle: { colors, mood, typography, stylePrompt }
  - createdAt, updatedAt
- [ ] Create `convex/designSystems.ts`
  - createDesignSystem mutation
  - getMyDesignSystems query
  - deleteDesignSystem mutation
  - extractStyleFromImages (calls Gemini to analyze references)

### Frontend
- [ ] Create `components/design-systems/design-system-creator.tsx`
  - Upload 1-3 reference images
  - Preview extracted colors/style
  - Name and save the design system
- [ ] Create `components/design-systems/design-system-selector.tsx`
  - Dropdown in Studio to select active design system
  - Shows color swatches preview
- [ ] Create `components/design-systems/style-preview.tsx`
  - Visual display of extracted colors, mood, style description
- [ ] Update `ImageCombiner` to prepend style prompt when design system is selected

---

## 2. Folders for Asset Organization

> Let users organize images in folders by project, style, or collection

### Backend
- [ ] Add `folders` table to Convex schema
  - userId, name, description
  - parentFolderId (for nested folders)
  - type: "project" | "design-system" | "collection"
  - designSystemId (optional link)
  - createdAt
- [ ] Update `generations` table to include `folderId`
- [ ] Create `convex/folders.ts`
  - createFolder, updateFolder, deleteFolder mutations
  - getMyFolders query
  - getFolderContents query
  - moveToFolder mutation

### Frontend
- [ ] Create `components/folders/folder-sidebar.tsx`
  - Tree view of folders
  - Create/rename/delete folders
- [ ] Create `components/folders/folder-view.tsx`
  - Grid view of folder contents
  - Drag-drop support
- [ ] Create `components/folders/move-to-folder-modal.tsx`
  - Move images between folders
- [ ] Add folder assignment option after generation
- [ ] Add "Folders" tab to sidebar navigation

---

## 3. Secure BYOK (Bring Your Own Key)

> Encrypted API key storage instead of plain localStorage

### Implementation
- [ ] Create `lib/secure-storage.ts`
  - Use Web Crypto API for encryption
  - Derive encryption key from user identifier
  - `encryptApiKey(key: string): Promise<string>`
  - `decryptApiKey(encrypted: string): Promise<string>`
  - `storeSecureKey(key: string): Promise<void>`
  - `getSecureKey(): Promise<string | null>`
  - `clearSecureKey(): void`

### Frontend Updates
- [ ] Update `components/dashboard/sidebar.tsx`
  - Replace localStorage calls with secure storage
  - Add encryption status indicator (🔒 icon)
  - Add "Test Key" button to validate API key works before saving
- [ ] Show "Key encrypted" confirmation after saving

---

## 4. Real Dashboard Analytics

> Replace hardcoded stats with actual usage data and cost tracking

### Backend
- [ ] Update `generations` table to track:
  - estimatedCost (USD)
  - tokensUsed
  - model name
- [ ] Create `lib/cost-calculator.ts`
  - Gemini pricing: ~$0.0025/image for standard, more for 4K
  - Calculate based on imageSize and mode
- [ ] Add analytics queries to `convex/generations.ts`:
  - `getUsageStats` - total generations, total cost, this month vs last
  - `getDailyUsage` - array of { date, count, cost } for charts
  - `getCostBreakdown` - by model and by mode
  - `getUsageTrends` - percentage changes

### Frontend Updates
- [ ] Update `components/dashboard/stats-cards.tsx`
  - Fetch real generation count from Convex
  - Show actual estimated costs
  - Calculate real percentage trends
- [ ] Update `components/dashboard/generation-chart.tsx`
  - Use real daily/weekly data
  - Add cost overlay toggle
  - Add mode breakdown (text-to-image vs image-editing)
- [ ] Add cost display in generation history items

---

## Implementation Priority

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| 1 | Dashboard Real Data | Medium | Quick win, improves UX immediately |
| 2 | Secure BYOK | Low | Security improvement, small scope |
| 3 | Folders | Medium | Organization is key for power users |
| 4 | Design Systems | High | Most complex, biggest value add |

---

## Files to Create

```
lib/
  secure-storage.ts      # Encrypted API key storage
  cost-calculator.ts     # Gemini API cost estimation

convex/
  folders.ts             # Folder CRUD operations
  designSystems.ts       # Design system CRUD + style extraction

components/
  design-systems/
    design-system-creator.tsx
    design-system-selector.tsx
    style-preview.tsx
  folders/
    folder-sidebar.tsx
    folder-view.tsx
    move-to-folder-modal.tsx
```

## Files to Modify

```
convex/schema.ts              # Add designSystems, folders tables
convex/generations.ts         # Add analytics queries, folder support
app/api/generate-image/route.ts  # Track costs, design system styles
components/dashboard/sidebar.tsx    # Secure storage, folders nav
components/dashboard/stats-cards.tsx   # Real data
components/dashboard/generation-chart.tsx  # Real chart data
components/image-combiner/index.tsx  # Design system selector, folder assignment
```

---

## Notes

- Gemini API pricing (as of 2024): ~$0.0025 per image generation
- Web Crypto API is available in all modern browsers
- Consider adding export functionality for design systems later

