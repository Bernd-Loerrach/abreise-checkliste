import SwiftUI

/// Verb tables: Presente | Pretérito perfeito | Imperativo.
struct ConjugationSheet: View {
    @Environment(\.dismiss) private var dismiss
    let card: Card
    let entry: ConjEntry
    @AppStorage("conjTense") private var tense = "f"

    private static let pronouns = ["eu", "tu", "ele / ela / você", "nós", "eles / elas / vocês"]
    private static let impPronouns = ["tu", "tu (negative)", "você", "vocês"]

    private var tenses: [(key: String, label: String)] {
        var t = [("f", "Presente")]
        if entry.p != nil { t.append(("p", "Pretérito")) }
        if entry.i != nil { t.append(("i", "Imperativo")) }
        return t.map { (key: $0.0, label: $0.1) }
    }

    private var current: String { tenses.contains { $0.key == tense } ? tense : "f" }

    var body: some View {
        let (forms, kind, name, prons): ([String], String?, String, [String]) = {
            switch current {
            case "p": return (entry.p ?? [], entry.tp, "past tense (pretérito perfeito)", Self.pronouns)
            case "i": return (entry.i ?? [], entry.ti, "imperative · tu = informal, você(s) = formal", Self.impPronouns)
            default: return (entry.f, entry.t, "present tense", Self.pronouns)
            }
        }()

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(card.en) · \(name)").font(.subheadline).foregroundStyle(.secondary)
                        if let kind { tag(kind) }
                    }
                    if tenses.count > 1 {
                        Picker("Tense", selection: $tense) {
                            ForEach(tenses, id: \.key) { Text($0.label).tag($0.key) }
                        }
                        .pickerStyle(.segmented)
                    }
                    VStack(spacing: 0) {
                        ForEach(Array(forms.enumerated()), id: \.offset) { i, f in
                            if !f.isEmpty {
                                HStack(spacing: 12) {
                                    Text(prons[i]).font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                                        .frame(width: 110, alignment: .leading)
                                    Text(current == "i" ? f + "!" : f).font(.title3.weight(.bold))
                                    Spacer()
                                    SpeakButton(text: f, size: 36)
                                }
                                .padding(.vertical, 10)
                                Divider()
                            }
                        }
                    }
                    Link(destination: PT.infopediaVerb(card.pt)) {
                        Label("All tenses on Infopedia", systemImage: "arrow.up.right")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
                    }
                }
                .padding(20)
            }
            .navigationTitle(card.pt)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
        // iPad / Mac: the half-height sheet would cut the table off, so open it full size.
        .presentationDetents(UIDevice.current.userInterfaceIdiom == .pad ? [.large] : [.medium, .large])
    }

    private func tag(_ kind: String) -> some View {
        let color: Color = kind == "irregular" ? .orange : kind == "regular" ? .accentColor : .secondary
        return Text(kind.capitalized)
            .font(.caption.weight(.bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 2)
            .overlay(Capsule().stroke(color, lineWidth: 1.2))
    }
}
