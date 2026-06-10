# 🦉 The Grand Archives: Search Architecture Tutorial

This codex details the implementation and maintenance of the **"Level 2" Search Engine** inside the Owl Academy's Grand Archives (`library_home.html`).

---

## How It Works

Previously, the search bar simply hid or revealed the HTML blocks (Department Cards) physically written on the page.

**The Upgrade:** The search is now powered by a **Universal Search Index** — a JavaScript array built into the bottom of `library_home.html`.

1. **The Default State:** When the search bar is empty, the user sees the beautifully formatted Department Grid.
2. **The Search State:** The moment a user types, the script hides the Department Grid. It scans the `archiveIndex` array, extracts any matching modules, and dynamically builds clean, clickable result cards on the screen.

Because it queries the array instead of the page's HTML structure, this automatically provides **granular module filtering (Level 1)**. Searching `"Torus"` yields just the Clifford Torus module, not the entire Sacred Geometry department.

---

## 🛠️ Step-by-Step: Adding a New Tutorial Module

To add a new tutorial (like a page on "Quaternions"), you must do two things: update the **visual HTML grid** (for browsing) and update the **JavaScript Index** (for searching).

### Step 1: Update the Visual UI

Locate the Department card where the module belongs (e.g., Department I) in `library_home.html`. Copy an existing `<a class="module-link group/link">` block and update the text/URL.

```html
<a href="quaternions.html" class="module-link group/link">
    <span class="text-yellow-600 mr-3 text-lg opacity-50 group-hover/link:opacity-100 transition">⬡</span>
    <div class="flex-grow">
        <div class="text-sm font-medium">Quaternions</div>
        <div class="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">4D Rotational Matrices</div>
    </div>
    <!-- ... svg icon ... -->
</a>
```

### Step 2: Register it in the Universal Index

Scroll to the very bottom of `library_home.html` and locate the `<script>` tag containing `const archiveIndex = [ ... ]`.

Add your new module as a JSON object into this list:

```js
{
    title: "Quaternions",
    type: "4D Rotational Matrices", // Appears as the subtext
    department: "Sacred Geometry & Topology",
    url: "quaternions.html",
    keywords: ["quaternion", "rotation", "4d", "matrix", "hamilton", "gimbal lock"]
}
```

> **Note:** The `keywords` array acts as invisible metadata. Add alternate spellings or related concepts here to make the search highly robust!

---

## 🏛️ Step-by-Step: Adding an Entirely New Department

Adding a new Department involves creating a new large HTML card and adding its modules to the index.

1. Find the `<!-- Archive Grid -->` section in `library_home.html`.
2. Copy an entire `<div class="glass-panel ... archive-card">` block.
3. Paste it below the others.
4. Update its ID, colors, icon SVG, and title.
5. Fill it with new `<a class="module-link">` links.
6. Register all those new links in the `archiveIndex` JavaScript array at the bottom, making sure to use your new Department name in the `department:` field of each JSON object.

---

## 💡 Best Practices for the Universal Index

**URL Routing**
Your `url:` parameter can point to a standalone page (e.g., `"clifford_torus.html"`) or jump directly to a specific branch on a department overview page (e.g., `"dept2_cryptography.html#branch3"`).

**Locked Modules**
If you want a module to appear locked/sealed in search results, simply include the word `"Sealed"` anywhere in its `type:` parameter (e.g., `type: "Sealed Tome"`). The JavaScript engine detects this keyword and automatically grays out the card and disables the link.

**Case Sensitivity**
You do not need to worry about casing in your `keywords` array. The search engine automatically normalizes all inputs and queries to lowercase.
