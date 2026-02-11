!include "MUI2.nsh"

; --- Design & Styling ---
; Verwende System-Look für Controls (Buttons, Bars)
XPStyle on

; Moderne Schriftart in passender Größe
!define MUI_FONT "Segoe UI"
!define MUI_FONTSIZE 11

; Verhindere das Verzerren von Bildern (hilft gegen "pixelig")
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH
!define MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH

; --- Seitenkonfiguration ---
; (Wir definieren nur das Aussehen, Electron-Builder erstellt die Seiten selbst)

; Willkommensseite mit modernem Titel
!define MUI_WELCOMEPAGE_TITLE "Welcome to the ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${PRODUCT_NAME}.$\r$\n$\r$\nIt is recommended that you close all other programs before continuing."

; Abschlussseite Konfiguration
; (Ueberschreibe Standardwerte sicher)
; MUI_FINISHPAGE_RUN wird von electron-builder automatisch gesetzt, nicht neu definieren!

!ifdef MUI_FINISHPAGE_RUN_TEXT
  !undef MUI_FINISHPAGE_RUN_TEXT
!endif
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME} now"

; --- Callback Funktionen ---
; (Keine speziellen Callbacks mehr benötigt)

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to delete all saved servers and settings?$\r$\n(The folder will be permanently removed)" /SD IDNO IDNO +2
  RMDir /r "$APPDATA\Catalyst"
!macroend
