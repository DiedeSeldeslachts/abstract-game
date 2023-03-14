using Assets.Scripts.Pawns;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace Assets.Scripts.Pawns
{
    public class PushPawnLogic : PawnLogicBase
    {
        public override void Init(Player p, int x, int y)
        {
            base.Init(p, x, y);
            var spriteRenderer = GetComponent<SpriteRenderer>();

            var spriteHolder = GetComponent<PawnSpriteHolder>();

            switch (p)
            {
                case Player.Blue:
                    spriteRenderer.sprite = spriteHolder.blue_push_pawn;
                    break;
                case Player.Red:
                    spriteRenderer.sprite = spriteHolder.red_push_pawn;
                    break;
            }
        }
    }
}
