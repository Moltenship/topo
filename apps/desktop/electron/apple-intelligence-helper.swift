import Dispatch
import Foundation
import FoundationModels

struct HelperRequest: Decodable {
    let systemPrompt: String?
    let prompt: String
    let maxTokens: Int?
}

struct HelperResponse: Encodable {
    let success: Bool
    let status: String
    let reason: String
    let text: String?
}

@available(macOS 26.0, *)
@Generable
struct CleanedTranscript: Sendable {
    let cleanedText: String
}

func writeResponse(_ response: HelperResponse) {
    let encoder = JSONEncoder()
    let data = try! encoder.encode(response)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func availabilityResponse() -> HelperResponse {
    guard #available(macOS 26.0, *) else {
        return HelperResponse(
            success: false,
            status: "device-not-eligible",
            reason: "Apple Intelligence requires macOS 26 or newer.",
            text: nil
        )
    }

    switch SystemLanguageModel.default.availability {
    case .available:
        return HelperResponse(
            success: true,
            status: "available",
            reason: "Apple Intelligence is ready on this Mac.",
            text: nil
        )
    case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible:
            return HelperResponse(
                success: false,
                status: "device-not-eligible",
                reason: "This Mac is not eligible for Apple Intelligence.",
                text: nil
            )
        case .appleIntelligenceNotEnabled:
            return HelperResponse(
                success: false,
                status: "apple-intelligence-disabled",
                reason: "Apple Intelligence is disabled in macOS settings.",
                text: nil
            )
        case .modelNotReady:
            return HelperResponse(
                success: false,
                status: "model-not-ready",
                reason: "Apple Intelligence models are not ready yet.",
                text: nil
            )
        @unknown default:
            return HelperResponse(
                success: false,
                status: "unknown",
                reason: "Apple Intelligence availability is unknown.",
                text: nil
            )
        }
    }
}

func readRequest() throws -> HelperRequest {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    return try JSONDecoder().decode(HelperRequest.self, from: input)
}

@available(macOS 26.0, *)
func generateText(_ request: HelperRequest) async -> HelperResponse {
    let availability = availabilityResponse()
    guard availability.status == "available" else {
        return availability
    }

    do {
        let model = SystemLanguageModel.default
        let session = LanguageModelSession(model: model, instructions: request.systemPrompt)
        let options = GenerationOptions(maximumResponseTokens: request.maxTokens)

        do {
            let structured = try await session.respond(
                to: request.prompt,
                generating: CleanedTranscript.self,
                options: options
            )
            return HelperResponse(
                success: true,
                status: "available",
                reason: "Generated with Apple Intelligence.",
                text: structured.content.cleanedText
            )
        } catch {
            let fallback = try await session.respond(to: request.prompt, options: options)
            return HelperResponse(
                success: true,
                status: "available",
                reason: "Generated with Apple Intelligence.",
                text: fallback.content
            )
        }
    } catch {
        return HelperResponse(
            success: false,
            status: "unknown",
            reason: error.localizedDescription,
            text: nil
        )
    }
}

@main
struct AppleIntelligenceHelper {
    static func main() async {
        let command = CommandLine.arguments.dropFirst().first ?? "probe"

        if command == "probe" {
            writeResponse(availabilityResponse())
            return
        }

        guard command == "generate" else {
            writeResponse(
                HelperResponse(
                    success: false,
                    status: "unknown",
                    reason: "Unknown helper command.",
                    text: nil
                )
            )
            return
        }

        guard #available(macOS 26.0, *) else {
            writeResponse(availabilityResponse())
            return
        }

        do {
            writeResponse(try await generateText(readRequest()))
        } catch {
            writeResponse(
                HelperResponse(
                    success: false,
                    status: "unknown",
                    reason: error.localizedDescription,
                    text: nil
                )
            )
        }
    }
}
