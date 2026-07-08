<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Content-Type: text/html; charset=UTF-8");

$receipt_id = $_GET['id'] ?? '';

if (empty($receipt_id)) {
    die("Receipt ID is required");
}

// Fetch from Flask API
$api_url = "https://db.7fun7-api.online/api?type=betslips&action=get&id=" . urlencode($receipt_id);
$response = @file_get_contents($api_url);

if ($response === false) {
    die("Failed to connect to API");
}

$slip = json_decode($response, true);

if (!$slip || isset($slip['error'])) {
    die("Receipt not found");
}

$matches = $slip['matches'] ?? [];
$date = date('Y-m-d H:i:s', strtotime($slip['created_at']));

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bet Receipt - <?php echo htmlspecialchars($receipt_id); ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background-color: #0f172a;
            color: #f8fafc;
            font-family: 'Inter', sans-serif;
        }
        .receipt-container {
            max-width: 500px;
            margin: 2rem auto;
            background: #1e293b;
            border-radius: 1.5rem;
            padding: 2rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
        }
        .status-accepted { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        .status-win { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        .status-win-half { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
        .status-lose { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .status-lose-half { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .status-draw { background: rgba(234, 179, 8, 0.2); color: #facc15; }
        .status-rejected { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
        .status-cancelled { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
        .status-pending { background: rgba(234, 179, 8, 0.2); color: #facc15; }
        
        @media print {
            body { background: white; color: black; }
            .receipt-container { box-shadow: none; border: 1px solid #ccc; margin: 0; max-width: 100%; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="flex justify-between items-start mb-8">
            <div>
                <h1 class="text-2xl font-black tracking-tighter uppercase italic text-blue-500">7FUN7</h1>
                <p class="text-xs text-slate-400 font-medium">Official Betting Receipt</p>
            </div>
            <div class="text-right">
                <div class="status-badge <?php 
                    $status = strtolower($slip['status']);
                    if (strpos($status, 'win') !== false) echo 'status-win';
                    elseif (strpos($status, 'lose') !== false) echo 'status-lose';
                    elseif ($status === 'accepted') echo 'status-accepted';
                    else echo 'status-pending';
                ?>">
                    <?php echo htmlspecialchars($slip['status']); ?>
                </div>
            </div>
        </div>

        <div class="space-y-4 mb-8">
            <div class="flex justify-between text-sm">
                <span class="text-slate-400">Receipt ID</span>
                <span class="font-mono font-bold"><?php echo htmlspecialchars($receipt_id); ?></span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-slate-400">Username</span>
                <span class="font-bold"><?php echo htmlspecialchars($slip['username']); ?></span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-slate-400">Date & Time</span>
                <span class="font-medium"><?php echo $date; ?></span>
            </div>
        </div>

        <div class="border-t border-slate-700 pt-6 mb-8">
            <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Matches (<?php echo count($matches); ?>)</h3>
            <div class="space-y-6">
                <?php foreach ($matches as $match): ?>
                <div class="relative">
                    <div class="text-[10px] text-blue-400 font-bold uppercase mb-1"><?php echo htmlspecialchars($match['matchName']); ?></div>
                    <div class="flex justify-between items-center">
                        <div class="text-sm font-bold"><?php echo htmlspecialchars($match['selection']); ?></div>
                        <div class="flex items-center gap-3">
                            <div class="text-sm font-black text-yellow-500">@<?php echo number_format($match['odd'], 2); ?></div>
                            <?php if (isset($match['status'])): ?>
                            <div class="status-badge <?php 
                                $mStatus = strtolower($match['status']);
                                if (strpos($mStatus, 'win all') !== false) echo 'status-win';
                                elseif (strpos($mStatus, 'win half') !== false) echo 'status-win-half';
                                elseif (strpos($mStatus, 'lose all') !== false) echo 'status-lose';
                                elseif (strpos($mStatus, 'lose half') !== false) echo 'status-lose-half';
                                elseif (strpos($mStatus, 'draw') !== false) echo 'status-draw';
                                elseif (strpos($mStatus, 'rejected') !== false) echo 'status-rejected';
                                elseif (strpos($mStatus, 'cancelled') !== false) echo 'status-cancelled';
                                elseif ($mStatus === 'accepted') echo 'status-accepted';
                                else echo 'status-pending';
                            ?>" style="font-size: 0.6rem; padding: 0.1rem 0.5rem;">
                                <?php echo htmlspecialchars($match['status']); ?>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="bg-slate-800/50 rounded-2xl p-6 space-y-3">
            <div class="flex justify-between text-sm">
                <span class="text-slate-400">Total Odds</span>
                <span class="font-black text-yellow-500">@<?php echo number_format($slip['total_odd'], 2); ?></span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-slate-400">Bet Amount</span>
                <span class="font-black"><?php echo number_format($slip['bet_amount'], 2); ?></span>
            </div>
            <div class="pt-3 border-t border-slate-700 flex justify-between items-center">
                <span class="text-sm font-bold text-blue-400">Potential Payout</span>
                <span class="text-xl font-black text-green-400"><?php echo number_format($slip['bet_amount'] * $slip['total_odd'], 2); ?></span>
            </div>
        </div>

        <div class="mt-8 flex gap-3 no-print">
            <button onclick="window.print()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
                Print Receipt
            </button>
            <button onclick="window.close()" class="px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-all">
                Close
            </button>
        </div>
        
        <p class="mt-8 text-[10px] text-center text-slate-500 font-medium">
            Thank you for betting with 7FUN7. Good luck!
        </p>
    </div>
</body>
</html>
