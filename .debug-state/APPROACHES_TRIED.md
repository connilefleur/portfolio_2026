# Approaches Tried

## Approach 1: OSC 8 Hyperlinks
**What:** Used xterm.js OSC 8 escape sequences to create real hyperlinks
```javascript
const url = `cmd://${encodeURIComponent(cmd)}`;
return `\x1b]8;;${url}\x07\x1b[36m\x1b[4m${cmd}\x1b[0m\x1b]8;;\x07`;
```
**Result:** Links not rendered as clickable, no cursor change

## Approach 2: registerLinkProvider API
**What:** Used xterm.js `registerLinkProvider` to define clickable regions
```javascript
terminal.registerLinkProvider({
  provideLinks: (lineNumber, callback) => {
    // Return ILink objects with range and activate callback
  }
});
```
**Result:** Links not detected, provideLinks may not be called correctly

## Approach 3: Manual Click Detection with Row/Col Calculation
**What:** Tracked clickable regions by row:col, calculated click position from mouse event
```javascript
const cellWidth = rect.width / terminal.cols;
const col = Math.floor((e.clientX - rect.left) / cellWidth);
```
**Result:** Column calculation was incorrect - clicks at col 26-32 but commands at cols 2-9

## Approach 4: Using xterm's Internal Cell Dimensions
**What:** Accessed `terminal._core._renderService.dimensions.css.cell` for accurate cell size
**Result:** Still incorrect column detection

## Approach 5: DOM Element Detection (Current)
**What:** Detect clicks on elements with `xterm-underline-*` class, extract text content
```javascript
const underlinedElement = target.closest('[class*="xterm-underline"]');
if (underlinedElement) {
  const text = underlinedElement.textContent;
  if (clickableCommands.has(text)) {
    injectCommand(text);
  }
}
```
**Result:** PENDING - needs testing

## Key Observations
1. The xterm.js rendering creates `<span>` elements with classes like `xterm-underline-1`, `xterm-fg-6`
2. These spans contain the command text directly
3. Click events ARE being captured (console logs show clicks)
4. The issue may be that xterm.js has its own event handling that intercepts clicks
