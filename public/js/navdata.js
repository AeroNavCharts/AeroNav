const NAV_AIRPORTS = {
    "IBLT": [-11250, 17513],
    "IBTH": [5756, -4501],
    "IDCS": [-4910, -44973],
    "IGAR": [-16340, 23717],
    "IHEN": [17113, 41192],
    "IIAB": [23216, 40509],
    "IJAF": [46152, 242],
    "IKFL": [-43088, -1587],
    "ILAR": [21260, 32419],
    "ILKL": [22590, -16515],
    "IMLR": [-19450, 14816],
    "IPAP": [31721, 34312],
    "IPPH": [18320, -20456],
    "IRFD": [-2881, 20064],
    "ISAU": [-46107, 27523],
    "ISCM": [36078, -5009],
    "ISKP": [25444, 13157],
    "ITKO": [-7541, -32296],
    "ITRC": [-2133, 30356],
    "IZOL": [44758, 3280]
};

const NAV_FIXES = {
    "ABSRS": [56255, 6717],
    "ACRES": [-49737, -10736],
    "ALDER": [-27457, 33418],
    "ALLRY": [7506, -18124],
    "ALTRS": [37349, 48776],
    "ANYMS": [15592, 18293],
    "AQWRT": [16232, 36269],
    "ASTRO": [-14251, -30573],
    "ATPEV": [5702, 16373],
    "BAR": [-37404, 30219],
    "BARNI": [-37404, 30219],
    "BEANS": [-26468, 18933],
    "BILLO": [48169, 11080],
    "BLA": [-7270, 14919],
    "BLANK": [-23559, -14284],
    "BOBOS": [-45200, -16029],
    "BOBUX": [40781, 35280],
    "BTM": [25423, -19869],
    "BUCFA": [-18963, 8753],
    "BULLY": [-32518, -29758],
    "CAMEL": [22456, -6256],
    "CAN": [10822, 39119],
    "CANDL": [10822, 39119],
    "CAWZE": [20129, 7647],
    "CELAR": [-36474, 5146],
    "CHAIN": [56139, 18933],
    "CHILY": [4830, -40521],
    "CLEAR": [21467, 14919],
    "CLR": [21467, 14919],
    "COC": [16523, -27373],
    "CRAZY": [19606, -35110],
    "CYRIL": [27808, 434],
    "DEBUG": [48111, 29462],
    "DEL": [29263, 11312],
    "DET": [47936, 17711],
    "DETOX": [47936, 17711],
    "DINER": [4539, -9921],
    "DIR": [13439, 44064],
    "DIZ": [49740, 4506],
    "DIZZI": [49740, 4506],
    "DOGGO": [37174, 7298],
    "DUNKS": [29495, -5965],
    "EMJAY": [-14309, 36036],
    "ENDER": [-19487, 666],
    "EURAD": [-26177, -20102],
    "EXMOR": [-18382, 26670],
    "EZYDB": [-23268, -4395],
    "FORCE": [21875, 48776],
    "FORIA": [7448, 42086],
    "FRANK": [-54275, 1946],
    "FROOT": [-38801, -22254],
    "GAVIN": [6808, 1423],
    "GEORG": [-44792, 22831],
    "GERLD": [-15066, -15331],
    "GODLU": [3783, 27310],
    "GOL": [-47352, -2417],
    "GOLDN": [-47352, -2417],
    "GRASS": [19024, 25623],
    "GRY": [-15531, 23180],
    "GULEG": [-20709, -25803],
    "GVK": [-42989, -3406],
    "HACKE": [-53111, 20329],
    "HAW": [-38975, -6082],
    "HAWFA": [-7445, 11487],
    "HAWKN": [-38975, -6082],
    "HECKS": [-55147, 30219],
    "HME": [-7096, -31969],
    "HOGGS": [-28853, 39701],
    "HONDA": [7564, -35052],
    "HOT": [36767, -4627],
    "HUNTR": [30950, 39410],
    "HUT": [30950, 39410],
    "ICTAM": [-12855, 12476],
    "INDEX": [-5525, -672],
    "IZO": [45726, 3982],
    "JACKI": [35080, 29462],
    "JAMSI": [9135, 22365],
    "JAZZR": [47995, 42203],
    "JOOPY": [-1453, -15331],
    "JUSTY": [39501, 16024],
    "KELLA": [35313, -18764],
    "KENED": [-11052, 3633],
    "KIN": [30775, 27543],
    "KINDL": [30775, 27543],
    "KNIFE": [2503, -24697],
    "KROTE": [-50377, 24518],
    "KRT": [-50377, 24518],
    "KUNAV": [-10994, 9451],
    "LAVNO": [2619, 17595],
    "LAZER": [8437, 29288],
    "LCK": [22166, 31673],
    "LETSE": [-3373, -35110],
    "LLIME": [54743, -8292],
    "LOGAN": [-19545, 20504],
    "MASEV": [30659, 48776],
    "MLR": [-18789, 14570],
    "MOGTA": [-10761, 23296],
    "MORRD": [51718, -1951],
    "MUONE": [39559, 42144],
    "NIKON": [-10761, -42208],
    "NJF": [46773, 143],
    "NOONU": [30310, -19054],
    "NUBER": [56139, 36792],
    "OCEEN": [12101, 5262],
    "ODOKU": [-3315, 36036],
    "ONDER": [-4478, -23010],
    "ORG": [19955, -15273],
    "PACKT": [-48108, 32197],
    "PEPUL": [-8027, 28823],
    "PER": [17221, -20800],
    "PFO": [31415, 34349],
    "PIPER": [-12157, -24988],
    "PROBE": [-6921, -10445],
    "QUEEN": [-1802, 15617],
    "REAPR": [-988, 43948],
    "RENDR": [-10935, -14284],
    "RENTS": [26587, 22133],
    "RES": [641, -4104],
    "RESUC": [641, -4104],
    "RFD": [-3256, 20155],
    "ROM": [9716, -10794],
    "ROMAN": [9716, -10794],
    "ROSMO": [40897, -9514],
    "SAU": [-45374, 27077],
    "SAWPE": [-27049, 10789],
    "SEEKS": [-36066, 25798],
    "SETHR": [3783, 7647],
    "SHELL": [-25013, -40288],
    "SHIBA": [-16985, -37670],
    "SHREK": [-45491, 11254],
    "SILVA": [17919, 1597],
    "SISTA": [33393, -12655],
    "SPACE": [-36125, 13057],
    "SQUID": [37407, -26035],
    "STACK": [-38801, 35687],
    "STRAX": [13323, -17309],
    "SUNST": [-24781, 5088],
    "TALIS": [26936, -11608],
    "THACC": [-54333, 10381],
    "THENR": [-38917, -12713],
    "TINDR": [11636, -22312],
    "TRE": [36302, 666],
    "TRELN": [-9772, 45460],
    "TRESN": [36302, 666],
    "TRN": [-1918, 29870],
    "TUDEP": [-14891, -18240],
    "UDMUG": [51601, -14051],
    "UWAIS": [-54857, -5733],
    "VOICE": [12276, -4453],
    "VOX": [12276, -4453],
    "WAGON": [44737, -29991],
    "WASTE": [-48690, 40574],
    "WELLS": [25947, -26210],
    "WELSH": [-11052, -4453],
    "WILLG": [-23268, -4395],
    "WOTAN": [35255, -33249],
    "YOUTH": [-31587, -8874],
    "ZESTA": [47413, -23359]
};

const NAV_PROCEDURES = {
    IBTH: {
        SID: [
            ["MOUNTAIN 1", ["DINER", "OCEEN"]],
            ["OCEAN 1", ["DINER", "OCEEN"]],
            ["RESURGE 1", ["PIPER", "PROBE", "WELSH", "INDEX"]],
            ["VONARX 1", ["DUNKS", "CAMEL", "CYRIL"]]
        ],
        STAR: [
            ["DINER 1", ["DINER", "TINDR", "KNIFE", "STRAX", "PROBE", "WELSH"]],
            ["GAVIN 1", ["GAVIN", "WELSH", "ENDER", "SILVA", "OCEEN", "SETHR"]],
            ["ROMENS 1", ["TINDR", "KNIFE", "STRAX", "DINER", "TALIS", "CAMEL"]],
            ["SILVA 1", ["SILVA", "CYRIL", "GAVIN", "OCEEN"]],
            ["WELSH 1", ["WELSH", "RENDR"]]
        ]
    },
    IIAB: {
        SID: [
            ["MCCONNELL 1", ["ANYMS", "RENTS", "JAMSI", "GRASS", "JACKI"]]
        ],
        STAR: [
            ["LARNACA 1", ["RENTS", "GRASS", "AQWRT"]]
        ]
    },
    IKFL: {
        SID: [
            ["BLANK 1", ["BLANK"]],
            ["CELAR 5", ["CELAR"]],
            ["WILLG 1", ["WILLG"]]
        ],
        STAR: [
            ["SPACE 2", ["SPACE"]]
        ]
    },
    ILAR: {
        SID: [
            ["GRASS 1", ["GRASS", "ANYMS", "RENTS"]],
            ["ODOKU 1", ["ODOKU", "LAZER"]],
            ["RENTS 1", ["RENTS", "CAWZE", "JUSTY", "ANYMS"]]
        ],
        STAR: [
            ["LUBAN 1", ["RENTS", "GRASS", "ODOKU"]],
            ["SOUTHERN 1", ["CAWZE", "JUSTY", "RENTS"]],
            ["WESTERN 1", ["ANYMS", "JAMSI", "RENTS", "GRASS"]]
        ]
    },
    IMLR: {
        SID: [
            ["BEANS 3", ["BEANS", "SPACE", "SEEKS"]],
            ["HAWFA 1", ["HAWFA", "OCEEN", "BUCFA", "KUNAV", "SAWPE", "ATPEV", "ANYMS", "SETHR"]],
            ["KENED 2", ["KENED", "RENDR", "DINER", "WELSH", "INDEX", "KUNAV", "ICTAM", "SAWPE"]],
            ["SAWPE 1", ["SAWPE", "BUCFA", "SPACE", "BEANS"]]
        ],
        STAR: [
            ["BIGDY 1", ["SETHR", "KUNAV", "HAWFA", "ATPEV"]],
            ["BUCFA 1", ["BUCFA", "SPACE", "BEANS", "SAWPE"]],
            ["NORTHERN 1", ["RENDR", "DINER", "WELSH", "INDEX", "KENED", "KUNAV", "BUCFA"]],
            ["URMOM 1", ["SPACE", "SEEKS", "ALDER", "BEANS"]]
        ]
    },
    IPAP: {
        SID: [
            ["KINDLE 1", ["JUSTY", "ANYMS", "RENTS", "GRASS"]]
        ],
        STAR: [
            ["JAMSI 1", ["JAMSI", "GRASS", "AQWRT"]],
            ["JUSTY 1", ["JUSTY", "BOBUX"]]
        ]
    },
    IPPH: {
        SID: [
            ["CAMEL 2", ["CAMEL", "TINDR", "NOONU", "STRAX", "TALIS"]],
            ["DINER 2", ["DINER", "TINDR", "NOONU", "STRAX", "TALIS"]],
            ["NARRX 1", ["TINDR", "NOONU", "STRAX", "TALIS"]],
            ["PERTH 2", ["ROSMO", "CAMEL", "CYRIL"]]
        ],
        STAR: [
            ["HONDA 2", ["HONDA", "STRAX"]],
            ["SISTA 2", ["SISTA", "NOONU", "CAMEL", "SILVA", "TALIS", "DINER"]],
            ["TALIS 2", ["TALIS", "TINDR", "CAMEL", "DUNKS", "SILVA", "CYRIL"]]
        ]
    },
    IRFD: {
        SID: [
            ["DARRK 3", ["SPACE", "BEANS", "SEEKS", "EXMOR"]],
            ["KENED 2", ["KENED", "JOOPY", "RENDR", "DINER", "PROBE", "WELSH", "INDEX", "KUNAV"]],
            ["LOGAN 4", ["LOGAN", "RENDR", "DINER", "WELSH", "BUCFA"]],
            ["OSHNN 1", ["CYRIL", "SILVA", "OCEEN", "ATPEV", "JAMSI", "GRASS"]],
            ["TRAINING 1", ["CYRIL", "SILVA", "OCEEN", "ATPEV", "JAMSI", "GRASS", "PEPUL", "GODLU"]],
            ["WNNDY 3", ["OCEEN", "SILVA"]]
        ],
        STAR: [
            ["BEANS 1", ["BEANS", "HAWFA", "SPACE", "LOGAN", "ICTAM", "SEEKS"]],
            ["GORDO 1", ["GODLU"]],
            ["JAMSI 1", ["JAMSI", "ANYMS", "GRASS", "GODLU", "PEPUL"]],
            ["KUNAV 2", ["KUNAV", "RENDR", "DINER", "WELSH", "INDEX", "KENED", "HAWFA"]],
            ["MELLOR 1", ["ICTAM"]],
            ["POPPY 3", ["GAVIN", "CYRIL", "SILVA", "OCEEN", "SETHR"]],
            ["SUNST 3", ["SUNST", "BUCFA", "HAWFA", "LOGAN"]]
        ]
    },
    ISAU: {
        SID: [
            ["ECHHO 1", ["THACC", "SPACE", "GEORG"]],
            ["SAUTHEMPTONA 1", ["THACC", "SHREK", "SPACE", "BEANS"]],
            ["SAYOW 1", ["EXMOR", "GODLU", "ALDER", "ODOKU"]],
            ["ZZOOO 1", ["GODLU", "STACK", "ODOKU", "PEPUL", "ALDER"]]
        ],
        STAR: [
            ["ALDER 1", ["ALDER", "PEPUL", "EMJAY"]],
            ["GEORG 1", ["GEORG", "SHREK", "SPACE"]],
            ["VYDDA 1", ["SEEKS", "BEANS", "EXMOR"]]
        ]
    },
    ITKO: {
        SID: [
            ["ASTRO 1", ["ASTRO", "GULEG", "PIPER", "ONDER", "BLANK", "PROBE", "DINER"]],
            ["HONDA 1", ["HONDA", "LETSE"]],
            ["LETSE 1", ["LETSE", "HONDA", "KNIFE", "ONDER", "RENDR", "PROBE"]],
            ["ONDER 1", ["ONDER", "PROBE", "DINER"]],
            ["TOKYO 1", ["ASTRO", "ONDER", "PIPER"]]
        ],
        STAR: [
            ["GULEG 1", ["GULEG", "EURAD", "PIPER", "ONDER", "BLANK"]],
            ["ISLAND 2", ["ONDER", "ASTRO", "KNIFE"]],
            ["KNIFE 2", ["KNIFE", "ONDER", "PROBE", "DINER"]],
            ["PIPER 1", ["PIPER", "ASTRO", "ONDER", "RENDR", "DINER"]]
        ]
    }
};
