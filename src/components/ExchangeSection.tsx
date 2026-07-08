import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRightLeft, DollarSign, Coins, CheckCircle2, Copy, FileText, Image as ImageIcon } from 'lucide-react';
import { toPng } from 'html-to-image';

export default function ExchangeSection() {
  const { t, user, updateUser, settings } = useApp();
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<{ id: string; amount: number; dollars: number; date: string } | null>(null);
  const [canCloseReceipt, setCanCloseReceipt] = useState(false);
  const [copying, setCopying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const copyReceiptImage = async () => {
    if (receiptRef.current) {
      try {
        setCopying(true);
        // Use a slightly higher scale for better quality
        const dataUrl = await toPng(receiptRef.current, { 
          backgroundColor: '#fff', 
          pixelRatio: 3,
          cacheBust: true,
        });
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        if (navigator.clipboard && navigator.clipboard.write) {
          const data = [new ClipboardItem({ [blob.type]: blob })];
          await navigator.clipboard.write(data);
          alert('Receipt image copied to clipboard!');
        } else {
          throw new Error('Clipboard API not available');
        }
      } catch (err) {
        console.error('Failed to copy image:', err);
        // Fallback: Download the image
        const link = document.createElement('a');
        link.download = `receipt-${receipt?.id}.png`;
        link.href = await toPng(receiptRef.current, { backgroundColor: '#fff' });
        link.click();
        alert('Clipboard copy failed. Receipt has been downloaded instead.');
      } finally {
        setCopying(false);
      }
    }
  };

  const handleExchange = async () => {
    if (!user || !settings || isSubmitting) return;
    const coins = Number(amount);
    const minAmount = settings.minExchangeAmount || 500;
    
    if (isNaN(coins) || coins < minAmount || coins > user.promotion_balance) {
      if (coins < minAmount) alert(`Minimum exchange amount is ${minAmount} coins.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const exchangeRate = settings.exchangeRate || 100;
      const dollars = coins / exchangeRate;
      const uniqueId = `EX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const date = new Date().toLocaleString();

      const newExchange = {
        id: uniqueId,
        amount: coins,
        dollars: dollars,
        date: date,
        username: user.username
      };

      const historyEntry = `Exchanged ${coins} coins for $${dollars.toFixed(2)}`;

      await updateUser(current => ({
        ...current,
        balance: current.balance - coins,
        promotion_balance: current.promotion_balance - coins,
        exchanges: [newExchange, ...(current.exchanges || [])].slice(0, 20)
      }), historyEntry);

      // Send withdraw notification
      const message = `User : ${user.username}\nWithdraw : ${dollars.toFixed(2)}$`;
      await fetch('https://api.7fun7-api.online/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message }),
      });

      setReceipt(newExchange);
      setCanCloseReceipt(false);
      setTimeout(() => setCanCloseReceipt(true), 3000);
      setAmount(''); // Clear input on success
    } catch (err) {
      console.error('Exchange failed:', err);
      alert('Exchange failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <h2 className="text-4xl font-black mb-12 flex items-center gap-3">
        <ArrowRightLeft className="text-blue-500" size={40} />
        {t.exchange}
      </h2>

      <div className="w-full max-w-md space-y-8">
        {/* Balance Card */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
              <img src="/currency.png" alt="coin" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Coins</p>
              <p className="text-2xl font-black text-yellow-500 tabular-nums">{user?.promotion_balance.toLocaleString() || 0}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{t.exchangeRate}</p>
            <p className="text-lg font-bold text-blue-400">{settings?.exchangeRate || 100} : $1</p>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-6">
          <div className="flex gap-2">
            {[500, 1000, 2000].map(val => (
              <button
                key={val}
                onClick={() => setAmount(String(val))}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-bold transition-all"
              >
                {val}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="number"
              value={amount}
              step="100"
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter amount (min ${settings?.minExchangeAmount || 500})...`}
              className="w-full pl-6 pr-20 py-6 bg-white/5 border border-white/10 rounded-[2rem] text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button
              onClick={() => setAmount(String(user?.promotion_balance || 0))}
              className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase transition-all"
            >
              Max
            </button>
          </div>

          <button
            onClick={handleExchange}
            disabled={!user || !amount || Number(amount) < (settings?.minExchangeAmount || 500) || Number(amount) > (user?.promotion_balance || 0) || isSubmitting}
            className={`w-full py-6 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-white/20 text-white font-black text-xl rounded-[2rem] shadow-2xl transform transition-all flex items-center justify-center gap-3 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t.processing || 'Processing...'}</span>
              </div>
            ) : (
              <>
                <DollarSign size={24} />
                {t.convert}
              </>
            )}
          </button>
        </div>

        {/* Receipt Modal */}
        {receipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white text-black rounded-[2.5rem] overflow-hidden shadow-2xl transform animate-in zoom-in duration-300">
              <div ref={receiptRef} className="bg-white p-8" style={{ backgroundColor: '#ffffff' }}>
                <div className="bg-zinc-100 p-8 text-center border-b border-zinc-200 rounded-t-3xl" style={{ backgroundColor: '#f4f4f5' }}>
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Success!</h3>
                  <h4 className="text-1xl font-green uppercase tracking-tighter">7Fun7 Promo</h4>
                  <p className="text-zinc-500 text-sm font-medium">Official Receipt</p>
                </div>
                
                <div className="p-8 space-y-4 font-mono text-sm bg-white">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">ID:</span>
                    <span className="font-bold">{receipt.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">User:</span>
                    <span className="font-bold">{user?.username}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-100 pt-4">
                    <span className="text-zinc-400">Amount:</span>
                    <span className="font-bold">{receipt.amount} Coins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Value:</span>
                    <span className="font-bold text-green-600">$ {receipt.dollars.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-100 pt-4">
                    <span className="text-zinc-400">Date:</span>
                    <span className="font-bold text-[10px]">{receipt.date}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 flex flex-col gap-2">
                <button
                  onClick={copyReceiptImage}
                  disabled={copying}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {copying ? (
                    <span className="animate-pulse">Copying...</span>
                  ) : (
                    <>
                      <Copy size={20} />
                      Copy Receipt Image
                    </>
                  )}
                </button>
                <button
                  onClick={() => setReceipt(null)}
                  disabled={!canCloseReceipt}
                  className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 transition-all"
                >
                  {canCloseReceipt ? 'Close' : 'Wait 3s...'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!user && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-10">
          <p className="text-xl font-bold text-white/80">Please Login to Exchange</p>
        </div>
      )}
    </div>
  );
}