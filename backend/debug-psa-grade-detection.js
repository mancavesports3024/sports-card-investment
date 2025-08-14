const { getPSAGrade } = require('./ultimate-multi-sport-filtering-system');

function debugPSAGradeDetection() {
    console.log('🔍 Debugging PSA Grade Detection...\n');

    const testTitles = [
        "LEO DE VRIES 2024 Bowman's Best Prospect #TP-18 Silver Wave Refractor PSA 10 GEM",
        "1991-92 Skybox #535 Karl Malone PSA 10 Gem Mint USA Basketball Dream Team!",
        "SHAQUILLE O'NEAL 1994-95 FLAIR BASKETBALL REJECTORS MAGIC PSA 10 Q0902",
        "⚡️PSA 10 2022 Donruss Optic Joe Burrow Electricity /65 SSP ⚡️",
        "2023 Panini National Treasures Treasured Rookies Bryce Young #TRC-BYG /99 PSA 10",
        "DEREK JETER 2007 TOPPS FINEST 68 BLUE REFRACTOR YANKEES SP #/399 PSA 10 GEM MINT",
        "2024 Topps Chrome Sapphire Julio Rodriguez Selections #SS-14 Mariners PSA 10",
        "2018-19 Panini Chronicles - Shai Gilgeous-Alexander Green #89 PSA 10",
        "2015 Topps Heritage Chrome Purple Refractor #563 Carlos Correa Astros RC PSA 10",
        "JOHAN SANTANA Twins 2000 Fleer Tradition Update #U43 Rookie RC PSA 10 Gem Mint",
        "2016 Bowman's Best of Orange Refractor /50 Kyle Schwarber PSA 10 Rookie Auto RC",
        "Michael Vick 2020 Panini Mosaic Genesis SSP PSA 10 #17 Atlanta Falcons Pop 12",
        "2002-03 Topps Finest #178 LeBron James Cavaliers RC Rookie PSA 10 GEM MINT",
        "JASSON DOMINGUEZ 2024 TOPPS HERITAGE #399 RC CHROME SILVER REFRACTOR PSA 10 GEM"
    ];

    testTitles.forEach((title, index) => {
        const grade = getPSAGrade(title);
        console.log(`${index + 1}. "${title}"`);
        console.log(`   Detected Grade: ${grade}`);
        console.log('');
    });
}

debugPSAGradeDetection();
