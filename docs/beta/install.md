# Install for testers

Five minutes. Chrome, Edge, Brave or any Chromium browser. No account.

1. Download the latest `natural-price-extension-<version>.zip` from the
   [releases page](https://github.com/Tumub/natural-price/releases) and
   unzip it somewhere you will not delete.
2. Open `chrome://extensions`, switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder.
4. Open a product page on ikea.com, mediamarkt.ch or nike.com. A small
   "Natural Price" panel appears bottom right within a few seconds.

5. In Chrome, open `chrome://extensions`, find Natural Price, click
   **Details**, and switch on **Allow in Incognito**. That is what lets the
   extension open a private tab on your device, which is how it compares
   prices. Firefox needs nothing extra.

Out of the box the extension compares on your device and sends nothing
anywhere, on any website. If you are willing to help the shared comparison
too, open the options (right-click the icon, Options) and choose **On this
device and on the server**. That contacts the server only for the four
companies listed on that page.

The private tab opens minimised and closes itself.

If the panel says it could not reach the service, open the options and
check the service URL matches the one in the release notes.

## What you will see

- **"A clean session was shown the same."** Most of the time. That is a
  result too; it is what we are measuring.
- **"A clean session was shown X, N% less."** Press the button to open the
  page in a private window and compare before you buy. If Chrome refuses
  to open the window, the link is copied instead.
- **"Could not compare."** Expand Details. Usually the site blocked the
  clean fetch. Tell us which site; that is the number we care about most.

## What leaves your browser

In the default setting, nothing. The comparison happens on your device.

If you switch a server setting on, then for the four listed companies only:
the page address without tracking parameters, the price, the currency, the
destination country the page shows, the time, and a hashed random install
id. Nothing about you, and the server rejects anything else. The full list
is [PRIVACY.md](../../PRIVACY.md).

## Uninstall

`chrome://extensions`, Remove. Nothing is left behind on the server except
anonymous counters.
