package dev.catalyst.analytics.data;

import java.util.HashMap;
import java.util.Map;

/**
 * Maps Minecraft protocol version numbers to human-readable version strings.
 */
public class ProtocolVersionMapper {

    private static final Map<Integer, String> PROTOCOL_MAP = new HashMap<>();

    static {
        // 1.21.x
        PROTOCOL_MAP.put(774, "1.21.4");
        PROTOCOL_MAP.put(769, "1.21.2/1.21.3");
        PROTOCOL_MAP.put(768, "1.21.1");
        PROTOCOL_MAP.put(767, "1.21");
        // 1.20.x
        PROTOCOL_MAP.put(766, "1.20.6");
        PROTOCOL_MAP.put(765, "1.20.5");
        PROTOCOL_MAP.put(764, "1.20.3/1.20.4");
        PROTOCOL_MAP.put(763, "1.20.2");
        PROTOCOL_MAP.put(762, "1.20/1.20.1");
        // 1.19.x
        PROTOCOL_MAP.put(761, "1.19.4");
        PROTOCOL_MAP.put(760, "1.19.3");
        PROTOCOL_MAP.put(759, "1.19/1.19.1/1.19.2");
        // 1.18.x
        PROTOCOL_MAP.put(758, "1.18.2");
        PROTOCOL_MAP.put(757, "1.18/1.18.1");
        // 1.17.x
        PROTOCOL_MAP.put(756, "1.17.1");
        PROTOCOL_MAP.put(755, "1.17");
        // 1.16.x
        PROTOCOL_MAP.put(754, "1.16.4/1.16.5");
        PROTOCOL_MAP.put(753, "1.16.3");
        PROTOCOL_MAP.put(751, "1.16.2");
        PROTOCOL_MAP.put(736, "1.16.1");
        PROTOCOL_MAP.put(735, "1.16");
        // 1.15.x
        PROTOCOL_MAP.put(578, "1.15.2");
        PROTOCOL_MAP.put(575, "1.15.1");
        PROTOCOL_MAP.put(573, "1.15");
        // 1.14.x
        PROTOCOL_MAP.put(498, "1.14.4");
        PROTOCOL_MAP.put(490, "1.14.3");
        PROTOCOL_MAP.put(485, "1.14.2");
        PROTOCOL_MAP.put(480, "1.14.1");
        PROTOCOL_MAP.put(477, "1.14");
        // 1.13.x
        PROTOCOL_MAP.put(404, "1.13.2");
        PROTOCOL_MAP.put(401, "1.13.1");
        PROTOCOL_MAP.put(393, "1.13");
        // 1.12.x
        PROTOCOL_MAP.put(340, "1.12.2");
        PROTOCOL_MAP.put(338, "1.12.1");
        PROTOCOL_MAP.put(335, "1.12");
        // 1.11.x
        PROTOCOL_MAP.put(316, "1.11.2");
        PROTOCOL_MAP.put(315, "1.11");
        // 1.10.x
        PROTOCOL_MAP.put(210, "1.10/1.10.1/1.10.2");
        // 1.9.x
        PROTOCOL_MAP.put(110, "1.9.4");
        PROTOCOL_MAP.put(109, "1.9.2");
        PROTOCOL_MAP.put(108, "1.9.1");
        PROTOCOL_MAP.put(107, "1.9");
        // 1.8.x
        PROTOCOL_MAP.put(47, "1.8/1.8.9");
    }

    /**
     * Map a protocol version number to a Minecraft version string.
     */
    public static String map(int protocolVersion) {
        return PROTOCOL_MAP.getOrDefault(protocolVersion, "Unknown (" + protocolVersion + ")");
    }
}
