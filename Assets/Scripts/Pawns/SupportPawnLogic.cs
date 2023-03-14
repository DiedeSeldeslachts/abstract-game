using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace Assets.Scripts.Pawns
{
    public class SupportPawnLogic : PawnLogicBase
    {
        public override void Init(Player p, int x, int y)
        {
            base.Init(p, x, y);
            var spriteRenderer = GetComponent<SpriteRenderer>();

            var spriteHolder = GetComponent<PawnSpriteHolder>();

            switch (p)
            {
                case Player.Neutral:
                    spriteRenderer.sprite = spriteHolder.neutral_pawn;
                    break;
                
            }
        }
    }
}
