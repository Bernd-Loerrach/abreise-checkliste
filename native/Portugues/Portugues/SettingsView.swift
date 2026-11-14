import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(VocabStore.self) private var vocab
    @Environment(ProgressStore.self) private var progress
    @Environment(Speaker.self) private var speaker
    @AppStorage("direction") private var direction = Direction.ptEn.rawValue
    @AppStorage("appearance") private var appearance = "auto"

    @State private var exportURL: URL?
    @State private var importing = false
    @State private var syncMessage: String?
    @State private var confirmReset = false

    var body: some View {
        @Bindable var speaker = speaker
        Form {
            Section {
                Picker("Direction", selection: $direction) {
                    ForEach(Direction.allCases) { Text($0.label).tag($0.rawValue) }
                }
            } footer: { Text("What's on the front of the card?") }

            Section {
                Toggle("Pronunciation", isOn: $speaker.soundOn)
                Button("Test voice") { speaker.speak("Olá! Bom dia.") }
                    .disabled(!speaker.soundOn)
                Picker("Appearance", selection: $appearance) {
                    Text("Auto").tag("auto")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
            } footer: {
                Text("Off = silent mode (same as the speaker button at the top). Better voices: iPhone Settings → Accessibility → Spoken Content → Voices → Portuguese.")
            }

            Section {
                Label("Syncs automatically through iCloud", systemImage: "checkmark.icloud")
                if let exportURL {
                    ShareLink(item: exportURL) { Label("Send progress file", systemImage: "square.and.arrow.up") }
                }
                Button { importing = true } label: { Label("Load progress file", systemImage: "square.and.arrow.down") }
                if let syncMessage {
                    Text(syncMessage).font(.footnote).foregroundStyle(syncMessage.hasPrefix("⚠️") ? .red : .accentColor)
                }
            } header: {
                Text("Sync between devices")
            } footer: {
                Text("iPhone, iPad and Mac signed in to the same Apple Account share your progress by themselves (iCloud must be on for this device). The progress file is for moving progress from the web version or an older install: “Send progress” there, then “Load progress file” here. For each word your latest answer is kept.")
            }

            Section {
                Button("Reset progress", role: .destructive) { confirmReset = true }
            }

            Section {
                LabeledContent("Words", value: "\(vocab.allCards.count)")
                LabeledContent("Word list", value: Date(timeIntervalSince1970: TimeInterval(vocab.version))
                    .formatted(date: .abbreviated, time: .omitted))
            } footer: {
                Text("New words are downloaded automatically when you're online.")
            }
        }
        .readableWidth(700)
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Settings")
        .onAppear { exportURL = try? progress.exportFile() }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json, .plainText, .data]) { result in
            switch result {
            case .success(let url):
                do {
                    let r = try progress.importFile(url)
                    let when = r.exported.map { " (file from \($0.formatted(date: .abbreviated, time: .shortened)))" } ?? ""
                    let learned = progress.stats(vocab.allCards).learned
                    syncMessage = r.changed > 0
                        ? "✓ Loaded: \(r.changed) word\(r.changed == 1 ? "" : "s") updated\(when). Learned now: \(learned)."
                        : "✓ Already up to date – nothing new in this file\(when)."
                    exportURL = try? progress.exportFile()
                } catch {
                    syncMessage = "⚠️ " + (error.localizedDescription)
                }
            case .failure:
                break
            }
        }
        .confirmationDialog("Really delete all your progress? This can't be undone.",
                            isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Delete all progress", role: .destructive) {
                progress.resetAll()
                exportURL = try? progress.exportFile()
            }
        }
    }
}

struct HelpView: View {
    @Environment(\.dismiss) private var dismiss
    let firstTime: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if firstTime {
                    Text("Welcome! 👋 Here's a one-minute guide. You can open it again anytime with the ⓘ button on the home screen.")
                        .font(.body)
                }
                card("🎯 Learn", """
                Each session mixes the words **due** for review with up to \(ProgressStore.learnBatch) **new** ones.

                Look at the card, try to recall the answer, then **tap to flip** (tap again to flip back). Rate yourself honestly: **✓ Got it** or **✗ Not yet**. Missed words come back again at the end of the session.
                """)
                card("📈 Why words come back later", """
                The app uses **spaced repetition**. Every “Got it” sends a word further into the future:

                tomorrow → 3 days → 7 days → 16 days → 35 days → 90 days

                “Not yet” starts it again from tomorrow. You review each word just before you'd forget it, so **a few minutes every day** works better than one long session.
                """)
                card("🔢 The three numbers", """
                **Due** – to review today. **New** – not practised yet.

                **Learned** – got right on **two different days**. So after your first session Learned is still 0 – that's normal. It starts growing from day two.
                """)
                card("🧭 More features", """
                • **Direction** (top of the home screen): Portuguese → English, English → Portuguese, or Both mixed.
                • **Topics**: practise one topic or letter at a time, or browse all its words.
                • **🧩 Quiz**: quick multiple choice; your answers count too.
                • **📖 Conjugation** on verb cards: present, past (pretérito perfeito) and imperative, marked regular or irregular.
                • **📘 Infopedia**: opens the word in the Infopedia dictionary (needs internet).
                • **🔊 / 🔇**: sound on or off (silent mode).
                """)
                card("📱 Your progress", """
                Progress **syncs automatically through iCloud** between your iPhone, iPad and Mac – just use the same Apple Account on all of them. It usually arrives within a minute or so.

                Coming from the web version or an older install? There: ⚙️ Settings → **Send progress**. Here: ⚙️ Settings → **Load progress file**. Nothing gets lost – for each word your latest answer is kept.
                """)
                Button {
                    dismiss()
                } label: {
                    Text(firstTime ? "Let's start 🚀" : "Back").font(.headline).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 16)
                        .background(RoundedRectangle(cornerRadius: 16).fill(Color.buttonGreen))
                }
                .buttonStyle(.plain)
            }
            .padding(16)
            .readableWidth(700)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("How it works")
    }

    private func card(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            Text(LocalizedStringKey(text)).font(.subheadline).fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }
}
