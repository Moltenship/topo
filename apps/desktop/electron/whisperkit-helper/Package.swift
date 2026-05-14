// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "WhisperKitHelper",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [
        .package(url: "https://github.com/argmaxinc/WhisperKit.git", from: "0.18.0")
    ],
    targets: [
        .executableTarget(
            name: "whisperkit-helper",
            dependencies: [
                .product(name: "WhisperKit", package: "WhisperKit")
            ],
            path: "Sources/WhisperKitHelper"
        )
    ]
)
