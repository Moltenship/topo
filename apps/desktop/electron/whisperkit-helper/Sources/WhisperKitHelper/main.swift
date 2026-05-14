import Foundation
import WhisperKit

struct HelperInput: Decodable {
    let audioPath: String
    let modelPath: String
    let language: String
}

struct HelperResponse: Encodable {
    let success: Bool
    let reason: String
    let text: String?
    let language: String?
    let durationInSeconds: Double?
    let warnings: [String]?
}

@main
struct WhisperKitHelper {
    static func main() async {
        let command = CommandLine.arguments.dropFirst().first ?? "probe"

        do {
            switch command {
            case "probe":
                respond(
                    HelperResponse(
                        success: true,
                        reason: "WhisperKit helper is available.",
                        text: nil,
                        language: nil,
                        durationInSeconds: nil,
                        warnings: nil
                    )
                )
            case "transcribe":
                let data = FileHandle.standardInput.readDataToEndOfFile()
                let input = try JSONDecoder().decode(HelperInput.self, from: data)
                let whisperKit = try await WhisperKit(
                    WhisperKitConfig(modelFolder: input.modelPath)
                )
                let language = input.language == "auto" ? nil : input.language
                let options = DecodingOptions(language: language)
                let start = Date()
                let results = try await whisperKit.transcribe(
                    audioPath: input.audioPath,
                    decodeOptions: options
                )
                let text = results.map(\.text).joined(separator: " ")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                respond(
                    HelperResponse(
                        success: true,
                        reason: "ok",
                        text: text,
                        language: input.language == "ru" ? "ru" : "en",
                        durationInSeconds: Date().timeIntervalSince(start),
                        warnings: []
                    )
                )
            default:
                respond(
                    HelperResponse(
                        success: false,
                        reason: "Unknown command: \(command)",
                        text: nil,
                        language: nil,
                        durationInSeconds: nil,
                        warnings: nil
                    )
                )
                exit(1)
            }
        } catch {
            respond(
                HelperResponse(
                    success: false,
                    reason: String(describing: error),
                    text: nil,
                    language: nil,
                    durationInSeconds: nil,
                    warnings: nil
                )
            )
            exit(1)
        }
    }

    static func respond(_ response: HelperResponse) {
        let data = try! JSONEncoder().encode(response)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data("\n".utf8))
    }
}
